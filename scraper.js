// This is a template for a Node.js scraper on morph.io (https://morph.io)

const cheerio = require('cheerio')
const rp = require('request-promise-native')
const sqlite = require('sqlite')

/* function updateRow(db, section, item) {
  // Insert some data.
  const statement = db.prepare('INSERT INTO data (approvalNumber, name, vat, taxCode, townRegion, category, associatedActivities, species, remarks, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  statement.run(item.approvalNumber, item.name, item.vat, item.taxCode, item.townRegion, item.category, item.associatedActivities, item.species, item.remarks, section)
  statement.finalize()
}

function readRows(db) {
  // Read some data.
  db.each('SELECT rowid AS id, approvalNumber FROM data', function(err, row) {
    console.log(row.id + ': ' + row.approvalNumber)
  })
} */

async function fetchListOfLists () {
  const $ = await fetchCheerio('http://www.salute.gov.it/portale/temi/trasferimento_PROD.jsp')
  const result = []
  console.log(1)
  for (const td of $.find('td.tabella01_cella_SX')) {
    var title = td.children('i').text().trim()
    title = title.substring(1, title.length - 1)
    if (title === 'All sections') {
      return
    }

    const tr = td.parent()
    const url = tr.find('a').attr('href')
    console.log(2)
    result.push({title: title, url: url})
    console.log(3)
  }

  console.log(4)
  return result
}

async function fetchTable (url) {
  const $ = await fetchCheerio(url)
  const tables = $('table.tabella01')
  const result = []
  if (!tables || tables.length === 0) {
    console.log('no tables for ' + url)
  } else {
    const table = $(tables[0])
    table.find('tr').each(function () {
      const tr = $(this)
      const firstTd = tr.find('td')[0]
      if (!firstTd || !$(firstTd).hasClass('tabella01_cella_SX')) {
        return
      }

      result.push(parseRow($, tr))
    })
  }

  return result
}

async function fetchCheerio (url) {
  const options = {
    uri: 'http://www.google.com',
    transform: function (body) {
      return cheerio.load(body)
    }
  }

  return rp(options)
}

function parseRow ($, tr) {
  const tds = tr.find('td')

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
  }
}

async function run () {
  const db = await sqlite.open('data.sqlite', { Promise })
  await db.migrate()

  const lists = await fetchListOfLists()
  for (const value of lists) {
    console.log(value)
    var table = await fetchTable(value.url)
    for (const item of table) {
      console.log(item)
    }
  }
}

run()
