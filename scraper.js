// This is a template for a Node.js scraper on morph.io (https://morph.io)

const cheerio = require('cheerio')
const iconvlite = require('iconv-lite')
const rp = require('request-promise-native')
const sqlite = require('sqlite')

// Since jQuery/cheerio objects are array-like,
// give them the same iterator method Arrays have
// https://hacks.mozilla.org/2015/04/es6-in-depth-iterators-and-the-for-of-loop/
cheerio.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator]

async function truncate (db) {
  await deleteRows(db)
  await vacuum(db)
}

async function deleteRows (db) {
  const statement = await db.prepare('DELETE FROM data')
  await statement.run()
  await statement.finalize()
}

async function vacuum (db) {
  const statement = await db.prepare('VACUUM')
  await statement.run()
  await statement.finalize()
}

async function updateRow (db, section, item) {
  const statement = await db.prepare('INSERT INTO data (approvalNumber, name, vat, taxCode, townRegion, category, associatedActivities, species, remarks, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  await statement.run(item.approvalNumber, item.name, item.vat, item.taxCode, item.townRegion, item.category, item.associatedActivities, item.species, item.remarks, section)
  await statement.finalize()
}

async function fetchListOfLists () {
  const $ = await fetchCheerio('http://www.salute.gov.it/portale/temi/trasferimento_PROD.jsp')
  const result = []
  const tds = $('td.tabella01_cella_SX')
  for (const td of tds) {
    var title = $(td).children('i').text().trim()
    title = title.substring(1, title.length - 1)
    if (title === 'All sections') {
      continue
    }

    const tr = $(td).parent()
    const url = $(tr).find('a').attr('href')
    result.push({title: title, url: url})
  }

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
    for (const tr of table.find('tr')) {
      const firstTd = $(tr).find('td')[0]
      if (!firstTd || !$(firstTd).hasClass('tabella01_cella_SX')) {
        continue
      }

      result.push(parseRow($, tr))
    }
  }

  return result
}

async function fetchCheerio (url) {
  const options = {
    uri: url,
    encoding: null,
    transform: function (body) {
      // original should be iso-8859-1 but apparently does not get decoded by request properly
      const decodedBody = iconvlite.decode(body, 'iso-8859-1')
      return cheerio.load(decodedBody)
    }
  }

  return rp(options)
}

function parseRow ($, tr) {
  const tds = $(tr).find('td')

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
  await truncate(db)

  const lists = await fetchListOfLists()
  for (const value of lists) {
    var table = await fetchTable(value.url)
    for (const item of table) {
      await updateRow(db, value.title, item)
    }
  }

  await db.close()
}

run()
