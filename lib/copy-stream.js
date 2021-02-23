'use strict'

const debug = require('debug')('supercopy')
const fs = require('fs')
const copyFrom = require('pg-copy-streams').from

function copyStream (statement, params, client) {
  return new Promise((resolve, reject) => {
    const components = statement.match(/COPY (.*?) FROM '([^']*)' (CSV [^;]*)/)
    const tableAndCols = components[1]
    const filename = components[2]
    const importOptions = components[3]
    const newStatement = `COPY ${tableAndCols} FROM STDIN ${importOptions};`
    debug(`Stream-Copy: ${newStatement} -- (${filename})`)
    const stream = client.query(
      copyFrom(newStatement)
    )
    stream.on('finish', function () {
      resolve()
    }).on('error', function (err) {
      reject(err)
    })

    const fileStream = fs.createReadStream(filename)
    fileStream.on('error', function (err) {
      reject(err)
    })

    fileStream.pipe(stream)
  })
} // copyStream

module.exports = copyStream
