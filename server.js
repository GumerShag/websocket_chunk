const WebSocket = require('ws');
const fs = require('fs');

const wss = new WebSocket.Server({port: 8080});
const FileStreamPath = "./media/video-for-loading.webm";
const LENGTH_SIZE = 256 * 1024;

function reverseString(str) {
    let newString = "";
    for (let i = str.length - 1; i >= 0; i--) {
        newString += str[i];
    }
    return newString;
}

wss.on('connection', function connection(ws, req) {
    const key = req.headers['sec-websocket-key'];
    console.log(key);
    console.log("############ OPENED")
    let fileSize = 0;
    fs.stat(FileStreamPath, function (error, stat) {
        if (error) {
            throw error;
        }
        fileSize = stat.size;
        ws.send(JSON.stringify({'method': 'open', 'fileSize': fileSize}));
    });

    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        data = JSON.parse(message);
        switch (data.method) {
            case 'getData':
                let start = parseInt(data.start);
                let chunks = [];
                if (start <= fileSize) {
                    var readStream = fs.createReadStream(FileStreamPath, {
                        encoding: "base64",
                        highWaterMark: LENGTH_SIZE,
                        start: start,
                        end: start + LENGTH_SIZE - 1
                    });
                    console.log('SEND: ', start, start + LENGTH_SIZE - 1)
                    readStream.on("data", function (chunk) {
                       // ws.send(JSON.stringify({'method': 'reserve', 'pack': start, 'data': chunk}));
                        chunks.push(chunk);
                        //TODO: Hot fix as on chunk is cutted to TWO
                        if (chunks.length === 2) {
                            ws.send(JSON.stringify({'method': 'reserve', 'pack': start, 'data': chunks.join('')}));
                            chunks = [];
                        }
                    }).on('end', function () {
                        console.log('INSIDE End', start, fileSize )
                        if (start >= fileSize || start + LENGTH_SIZE - 1 >= fileSize) {
                            ws.send(JSON.stringify({'method': 'end'}));
                            console.log('CLOSED')
                        }
                    });
                }
                break;
        }
    });
});
