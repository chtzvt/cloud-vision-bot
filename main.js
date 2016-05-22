var vision = require('google-vision-api-client');
var requtil = vision.requtil;
var fs = require('fs');
var request = require('request');
var Twitter = require('twitter');
var http = require('http');

var CONFIG = {
    TWITTER_API_KEYS: {
        consumer_key: '',
        consumer_secret: '',
        access_token_key: '',
        access_token_secret: ''
    },
    GCP_OAUTH_CREDENTIALS_PATH: './auth/GCP.json',
    IP: process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
    PORT: process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8082,
    TWITTER_URL: "https://twitter.com/cloudvisionbot",
    POST_INTERVAL: 3600000
};

vision.init(CONFIG.GCP_OAUTH_CREDENTIALS_PATH);
var client = new Twitter(CONFIG.TWITTER_API_KEYS);

console.info('CVBOT_INFO: Starting ' + CONFIG.TWITTER_URL + ' on ' + CONFIG.IP + ':' + CONFIG.PORT);

function getImageLabels(image) {
    var request = requtil.createRequests().addRequest(requtil.createRequest(image).withFeature('LABEL_DETECTION', 8).build());
    vision.query(request, function(error, response, data) {
        if (error) {
            console.info('CVBOT_DEBUG: Got an error! ', JSON.stringify(error));
        } else if (data) {
            sendTweet(data.responses[0].labelAnnotations);
        }
    });
}

function sendTweet(labels) {
    var data = require('fs').readFileSync('./tmp/image.jpeg');
    var text = "I can see " + labels[0].description + ", " + labels[2].description + ", and " + labels[4].description + ".";

    client.post('media/upload', {
        media: data
    }, function(error, media, response) {
        if (!error) {
            var status = {
                status: text,
                media_ids: media.media_id_string
            };
            client.post('statuses/update', status, function(error, tweet, response) {});
        }
    });
}

function getImage() {
    var imgReq = request.get('https://source.unsplash.com/random');
    imgReq.pipe(fs.createWriteStream('./tmp/image.jpeg'));
    imgReq.on('end', function() {
        getImageLabels('./tmp/image.jpeg');
    });
}

function cron() {
    try {
        getImage();
    } catch (err) {
        console.info('CVBOT_DEBUG: ' + CONFIG.TWITTER_URL + ' Caught ' + err.name + ': ' + err.message);
    }
    setTimeout(cron, CONFIG.POST_INTERVAL);
}

cron();

// HTTP requests made to the application's external URL will redirect to the bot's twitter profile.
http.createServer(function(req, res) {
    res.writeHead(301, {
        Location: CONFIG.TWITTER_URL
    });
    res.end();
}).listen(CONFIG.PORT, CONFIG.IP);
