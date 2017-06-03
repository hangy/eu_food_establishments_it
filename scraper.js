// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();

function initDatabase(callback) {
	// Set up sqlite database.
	var db = new sqlite3.Database("data.sqlite");
	db.serialize(function() {
		callback(db);
	});
}

function updateRow(db, section, item) {
	// Insert some data.
	var statement = db.prepare("INSERT INTO data (approvalNumber, name, vat, taxCode, townRegion, category, associatedActivities, species, remarks, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
	statement.run(item.approvalNumber, item.name, item.vat, item.taxCode, item.townRegion, item.category, item.associatedActivities, item.species, item.remarks, section);
	statement.finalize();
}

function readRows(db) {
	// Read some data.
	db.each("SELECT rowid AS id, approvalNumber FROM data", function(err, row) {
		console.log(row.id + ": " + row.approvalNumber);
	});
}

function fetchPage(url, callback) {
	request(url, function (error, response, body) {
		if (error) {
			console.log("Error requesting page: " + error);
			return;
		}

		callback(body);
	});
}

function fetchListOfLists(callback, done) {
	fetchCheerio("http://www.salute.gov.it/portale/temi/trasferimento_PROD.jsp", function($) {
		var x = $("td.tabella01_cella_SX").each(function () {
			var td = $(this);
			var title = td.children("i").text().trim();
			title = title.substring(1, title.length - 1)
			if (title === "All sections") {
				return;
			}

			var tr = td.parent();
			var url = tr.find("a").attr('href');
			callback(title, url);
		});

		done();
	});
}

function fetchTable(url, callback) {
	fetchCheerio(url, function($) {
		var tables = $("table.tabella01");
		if (!tables || tables.length === 0) {
			console.log("no tables for " + url);
		} else {
			var table = $(tables[0]);
			table.find("tr").each(function () {
				var tr = $(this);
				var firstTd = tr.find("td")[0];
				if (!firstTd || !$(firstTd).hasClass("tabella01_cella_SX")) {
					return;
				}

				callback(parseRow($, tr));
			});
		}
	});
}

function fetchCheerio(url, callback) {
	fetchPage(url, function(body) {
		callback(cheerio.load(body));
	});
}

function parseRow($, tr) {
	var tds = tr.find("td");

	return {
		approvalNumber: $(tds[0]).text().trim(),
		name: $(tds[1]).text().trim(),
		vat: $(tds[2]).text().trim(),
		taxCode: $(tds[3]).text().trim(),
		townRegion: $(tds[4]).text().trim(),
		category: $(tds[5]).text().trim(),
		associatedActivities: $(tds[6]).text().trim(),
		species: tds.length >= 8 ? $(tds[7]).text().trim() : null,
		remarks: tds.length >= 9 ? $(tds[8]).text().trim() : null
	};
}

function run(db) {
	fetchListOfLists(function (section, url) {
		fetchTable(url, function (item) {
			updateRow(db, section, item);
		});
	}, function() {
		readRows(db);

//		db.close();
	});
}

initDatabase(run);
