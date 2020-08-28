'use strict'

const _ = require('lodash')

module.exports = function addInsertStatements (scriptStatements, fileInfo, options) {
  if (Object.prototype.hasOwnProperty.call(fileInfo, 'inserts')) {
    _.forOwn(
      fileInfo.inserts,
      function (info, filePath) {
        scriptStatements.push(
          `COPY ${_.snakeCase(options.schemaName)}.${_.snakeCase(info.tableName)}(${info.columnNames.all.join(',')}) FROM '${filePath}' CSV HEADER ${options.sqlQuote};`
        )
      }
    )
  }
}
