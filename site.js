var utilities = require('./libs/utilities'),
	pg = require('pg'), 
    postgres = utilities.getDBConnection(),
    marked = require('marked'),
    moment = require('moment'),
    util = require('util');

markedOpts = {
	gfm: true,
	highlight: function (code, lang, callback) {
		pygmentize({ lang: lang, format: 'html' }, code, function (err, result) {
			callback(err, result.toString());
		});
	},
	tables: true,
	breaks: false,
	pedantic: false,
	sanitize: true,
	smartLists: true,
	smartypants: false,
	langPrefix: 'lang-'
}

exports.root = function(req, res) {
	res.redirect("http://quickcast.io");
};

exports.video = function(req, res) {
	var video_entry = req.params.entry,
		client = new pg.Client(postgres);

    client.connect();

    client.query("SELECT casts.*, users.username, tags.* FROM casts INNER JOIN users ON (casts.ownerid = users.userid) INNER JOIN WHERE lower(casts.uniqueid) = $1 AND casts.published = true", [video_entry.toLowerCase()], function(err1, result1){
    	client.end();
		if (!err1 && result1 != undefined && result1.rowCount > 0){
			var data = result1.rows[0];

			client.query("SELECT tags.name FROM casts_tags INNER JOIN tags ON (casts_tags.tagid = tags.tagid) WHERE casts_tags.castid = $1", [data.castid], function(err2, result2){
				
				client.end();

				var tags = null;

				if (!err2 && result2 != undefined && result2.rowCount > 0){
					tags = result2.rows;
				}

				utilities.logViews(video_entry, req, function(err, r) {
					marked(data.description, markedOpts, function (err, content) {
						if (err) throw err;

						var a = moment(data.created);
						var b = moment(new Date());

						var duration = moment(data.created).hours();

						var str = 'https://s3.amazonaws.com/quickcast/%s/%s/quickcast.%s';
						var fileCheck = '/%s/%s/quickcast.%s';

						var amazonDetails = utilities.getAmazonDetails();

						var s3 = require('aws2js').load('s3', amazonDetails.accessKeyId, amazonDetails.secretAccessKey)

						s3.setBucket(amazonDetails.destinationBucket);

						s3.head(util.format(fileCheck, data.ownerid, data.castid, 'webm'), function (err, s3res) {

							var processed = null;

							if (err && err.code === 404){
								processed = "processing";
								//if (duration > 2)
								//	processed = "failed";
							}
							else if (err && err.statusCode != 200)
								processed = "failed";

						    res.render('video', {
								mp4: util.format(str, data.ownerid, data.castid, 'mp4'),
								webm: util.format(str, data.ownerid, data.castid, 'webm'),
								body: content,
								views: data.views + r,
								title: data.name,
								username: data.username,
								when: a.from(b),
								processed: processed,
								id: data.castid,
								pageTitle: data.name,
								video_width: data.width,
								video_height: data.height,
								uniqueid: video_entry.toLowerCase(),
								tags: tags
							});

						});

						
					});

				});
			});
		}else{
			res.render('404', 404);
		}
	});
};

exports.embed = function(req, res) {
	var video_entry = req.params.entry,
		client = new pg.Client(postgres);

    client.connect();

    client.query("SELECT casts.*, users.username FROM casts INNER JOIN users ON (casts.ownerid = users.userid) WHERE lower(casts.uniqueid) = $1 AND casts.published = true", [video_entry.toLowerCase()], function(err1, result1){
		if (!err1 && result1 != undefined && result1.rowCount > 0){
			var data = result1.rows[0];

			var a = moment(data.created);
			var b = moment(new Date());

			var duration = moment(data.created).hours();

			var str = 'https://s3.amazonaws.com/quickcast/%s/%s/quickcast.%s';
			var fileCheck = '/%s/%s/quickcast.%s';

			var amazonDetails = utilities.getAmazonDetails();

			var s3 = require('aws2js').load('s3', amazonDetails.accessKeyId, amazonDetails.secretAccessKey)

			s3.setBucket(amazonDetails.destinationBucket);

			s3.head(util.format(fileCheck, data.ownerid, data.castid, 'webm'), function (err, s3res) {

				var processed = null;

				if (err && err.code === 404){
					processed = "processing";
					if (duration > 2)
						processed = "failed";
				}
				else if (err && err.statusCode != 200)
					processed = "failed";

			    res.render('embed', {
					mp4: util.format(str, data.ownerid, data.castid, 'mp4'),
					webm: util.format(str, data.ownerid, data.castid, 'webm'),
					processed: processed,
					id: data.castid,
					video_width: data.width,
					video_height: data.height,
					uniqueid: video_entry.toLowerCase()
				});

			});

		}else{
			res.render('404', 404);
		}
	});
};