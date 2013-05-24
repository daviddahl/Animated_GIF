// A library/utility for generating GIF files
// Uses Dean McNamee's omggif library
// and Anthony Dekker's NeuQuant quantizer (JS 0.3 version with many fixes)
//
// @author sole / http://soledadpenades.com
function Animated_GIF(options) {
    var width = 160, height = 120, canvas = null, ctx = null, repeat = 0, delay = 250;
    var buffer, gifWriter;
    var queuedFrames = [];
    var onRenderCompleteCallback = function() {};
    var workers = [], availableWorkers = [], numWorkers, workerPath;

    options = options || {};
    numWorkers = options.numWorkers || 2;
    workerPath = options.workerPath || 'src/quantizer.js'; // XXX hardcoded path

    for(var i = 0; i < numWorkers; i++) {
        var w = new Worker(workerPath);
        workers.push(w);
        availableWorkers.push(w);
    }

    // ---

    // Return a worker for processing a frame
    function getWorker() {
        if(availableWorkers.length === 0) {
            throw ('No workers left!');
        }

        return availableWorkers.pop();
    }

    // Restore a worker to the pool
    function freeWorker(worker) {
        availableWorkers.push(worker);
    }

    function bufferToString(buffer) {
        var numberValues = buffer.length;
        var str = '';
        
        for(var i = 0; i < numberValues; i++) {
            str += String.fromCharCode( buffer[i] );
        }

        return str;
    }

    function render(completeCallback) {
        var numFrames = queuedFrames.length;

        onRenderCompleteCallback = completeCallback;
//        buffer = new Uint8Array(width * height * numFrames * 5);
//        gifWriter = new GifWriter(buffer, width, height, { loop: repeat });

        for(var i = 0; i < numWorkers && i < queuedFrames.length; i++) {
            console.log('setting initial work load', i);
            processNextFrame(i);
        }
        // processNextFrame(0);
    }

    function processNextFrame(position) {

        console.log('processNextFrame', position);
        var frame = queuedFrames[position];
        var worker = getWorker();
        
        worker.onmessage = function(ev) {
            var data = ev.data;

            // Delete original data, and free memory
            delete(frame.data);

            // TODO grrr... HACK for object -> Array
            frame.pixels = Array.prototype.slice.call(data.pixels);
            frame.palette = Array.prototype.slice.call(data.palette);
            frame.done = true;

            freeWorker(worker);

            onFrameFinished(frame);
        };

        // TODO maybe look into transfer objects
        // for further efficiency
        var frameData = frame.data;
        //worker.postMessage(frameData, [frameData]);
        worker.postMessage(frameData);
        
    }

    function onFrameFinished(frame) {

        console.log('frame finished', frame.position);

        if(frame.position === queuedFrames.length - 1) {
            generateGIF(queuedFrames, onRenderCompleteCallback);
        } else {
            setTimeout(function() {
                processNextFrame(frame.position + 1);
            }, 1);
        }
        
    }

    function generateGIF(frames, callback) {
        console.log('generate GIF', frames.length);
        var buffer = new Uint8Array(width * height * frames.length * 5);
        var gifWriter = new GifWriter(buffer, width, height, { loop: repeat });

        for(var i = 0; i < frames.length; i++) {
            var frame = frames[i];
            gifWriter.addFrame(0, 0, width, height, frame.pixels, { palette: frame.palette, delay: delay });
        }

        gifWriter.end();
        callback(buffer);

    }
    
    // ---

    this.setSize = function(w, h) {
        width = w;
        height = h;
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext('2d');
    };

    this.setDelay = function(d) {
        delay = d;
    };

    this.setRepeat = function(r) {
        repeat = r;
    };

    this.setMaxNumColors = function(v) {
        maxNumColors = v;
    };

    this.addFrame = function(element) {

        if(ctx === null) {
            this.setSize(width, height);
        }

        ctx.drawImage(element, 0, 0, width, height);
        data = ctx.getImageData(0, 0, width, height);
        
        this.addFrameImageData(data.data);
    };

    this.addFrameImageData = function(imageData) {

        var dataLength = imageData.length,
            imageDataArray = new Uint8Array(imageData);

        queuedFrames.push({ data: imageDataArray, done: false, position: queuedFrames.length });

    };

    
    // TODO I like better the 'event emitter' approach for events, rendering etc

    this.getBase64GIF = function(completeCallback) {

        var onRenderComplete = function(buffer) {
            console.log('rendering complete');
            var str = bufferToString(buffer);
            var gif = 'data:image/gif;base64,' + btoa(str);
            completeCallback(gif);
        };

        render(onRenderComplete);

    };

}
