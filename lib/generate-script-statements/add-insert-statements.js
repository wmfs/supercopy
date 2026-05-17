'use strict';

const _ = require('lodash');

module.exports = function addInsertStatements(scriptStatements, fileInfo, options) {
  if (!Object.prototype.hasOwnProperty.call(fileInfo, 'inserts')) {
    return;
  }

  const topDownTableOrder = _.isArray(options.topDownTableOrder) ? options.topDownTableOrder : [];

  const inserts = _.map(fileInfo.inserts, (info, filePath) => ({ info, filePath }));

  const sortedInserts = _.sortBy(inserts, (insert) => {
    const idx = topDownTableOrder.indexOf(insert.info.tableName);
    return idx >= 0 ? idx : inserts.length;
  });

  sortedInserts.forEach(({ info, filePath }) =>
    scriptStatements.push(
      `COPY ${_.snakeCase(options.schemaName)}.${_.snakeCase(info.tableName)}(${info.columnNames.all.join(",")}) FROM '${filePath}' CSV HEADER ${options.sqlQuote};`,
    ),
  );
};
