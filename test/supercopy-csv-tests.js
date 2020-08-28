/* eslint-env mocha */

const process = require('process')
const expect = require('chai').expect
const HlPgClient = require('@wmfs/hl-pg-client')
const supercopy = require('./../lib')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

describe('Supercopy tests', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  const connectionString = process.env.PG_CONNECTION_STRING
  let client

  before(function () {
    if (process.env.PG_CONNECTION_STRING && !/^postgres:\/\/[^:]+:[^@]+@(?:localhost|127\.0\.0\.1).*$/.test(process.env.PG_CONNECTION_STRING)) {
      console.log(`Skipping tests due to unsafe PG_CONNECTION_STRING value (${process.env.PG_CONNECTION_STRING})`)
      this.skip()
    }
  })

  before('Create a new pg client', function () {
    client = new HlPgClient(connectionString)
  })

  before('Remove output directory ahead of csv tests, if it exists already', function (done) {
    const outputPath = path.resolve(__dirname, './output')
    if (fs.existsSync(outputPath)) {
      rimraf(outputPath, {}, done)
    } else {
      done()
    }
  })

  before('Load test data', async () => {
    for (const filename of ['uninstall.sql', 'install.sql']) { await client.runFile(path.resolve(__dirname, path.join('fixtures', 'scripts', filename))) }
  })

  const goodOptions = {
    topDownTableOrder: ['adults', 'children'],
    headerColumnNamePkPrefix: '.',
    schemaName: 'supercopy_test',
    debug: true
  }

  const testConfigs = [
    ['people'],
    ['people-quote', '\'']
  ]

  for (const [goodFixture, quoted] of testConfigs) {
    describe(`${goodFixture} data`, () => {
      it('reset test data', async () => {
        for (const filename of ['uninstall.sql', 'install.sql']) { await client.runFile(path.resolve(__dirname, path.join('fixtures', 'scripts', filename))) }
      })

      it('Supercopy some people', function () {
        goodOptions.client = client
        goodOptions.sourceDir = path.resolve(__dirname, './fixtures/input-data', goodFixture)
        goodOptions.quote = quoted

        return supercopy(goodOptions)
      })

      it('Verify adult rows', async () => {
        const result = await client.query('select adult_no,first_name,last_name from supercopy_test.adults order by adult_no')
        expect(result.rows).to.eql(
          [
            { adult_no: 10, first_name: 'Homer', last_name: 'Simpson' },
            { adult_no: 20, first_name: 'Marge', last_name: 'Simpson' },
            { adult_no: 30, first_name: 'Maud', last_name: 'Flanders' },
            { adult_no: 40, first_name: 'Ned', last_name: 'Flanders' },
            { adult_no: 50, first_name: 'Seymour', last_name: 'Skinner' },
            { adult_no: 60, first_name: 'Charles', last_name: 'Burns' },
            { adult_no: 80, first_name: 'Clancy', last_name: 'Wiggum' },
            { adult_no: 90, first_name: 'Abraham', last_name: 'Simpson' },
            { adult_no: 100, first_name: 'Mona', last_name: 'Simpson' }
          ]
        )
      })

      it('Verify modified children rows', async () => {
        const result = await client.query('select child_no,first_name,last_name from supercopy_test.children order by child_no')
        expect(result.rows).to.eql(
          [
            { child_no: 10, first_name: 'Lisa', last_name: 'Simpson' },
            { child_no: 20, first_name: 'Bart', last_name: 'Simpson' },
            { child_no: 30, first_name: 'Maggie', last_name: 'Simpson' },
            { child_no: 40, first_name: 'Rod', last_name: 'Flanders' },
            { child_no: 50, first_name: 'Todd', last_name: 'Flanders' },
            { child_no: 60, first_name: 'Nelson', last_name: 'Muntz' },
            { child_no: 70, first_name: 'Milhouse', last_name: 'Van Houten' }
          ]
        )
      })
    })
  } // for ...

  describe('bad data', () => {
    it('Fail on bad data', function (done) {
      supercopy(
        {
          sourceDir: path.resolve(__dirname, './fixtures/input-data/people-with-an-error'),
          topDownTableOrder: ['adults', 'children'],
          headerColumnNamePkPrefix: '.',
          client: client,
          schemaName: 'supercopy_test',
          debug: true
        },
        function (err) {
          expect(err).to.not.equal(null)
          done()
        }
      )
    })

    it('Fail on mis-shapen data', function (done) {
      supercopy(
        {
          sourceDir: path.resolve(__dirname, './fixtures/input-data/bad-people'),
          topDownTableOrder: ['adults'],
          headerColumnNamePkPrefix: '.',
          client: client,
          schemaName: 'supercopy_test',
          truncateTables: true,
          debug: true
        },
        function (err) {
          expect(err).to.not.equal(null)
          done()
        }
      )
    })
  })

  describe('truncate first', () => {
    it('supercopy some people, truncating the tables first', function () {
      return supercopy(
        {
          sourceDir: path.resolve(__dirname, './fixtures/input-data/people'),
          topDownTableOrder: ['adults', 'children'],
          headerColumnNamePkPrefix: '.',
          client: client,
          schemaName: 'supercopy_test',
          truncateTables: true,
          debug: true
        }
      )
    })

    it('Verify adult rows, truncated', async () => {
      const result = await client.query('select adult_no,first_name,last_name from supercopy_test.adults order by adult_no')
      expect(result.rows).to.eql(
        [
          { adult_no: 30, first_name: 'Maud', last_name: 'Flanders' },
          { adult_no: 40, first_name: 'Ned', last_name: 'Flanders' },
          { adult_no: 80, first_name: 'Clancy', last_name: 'Wiggum' },
          { adult_no: 90, first_name: 'Abraham', last_name: 'Simpson' },
          { adult_no: 100, first_name: 'Mona', last_name: 'Simpson' }
        ]
      )
    })

    it('Verify children rows (truncated)', async () => {
      const result = await client.query('select child_no,first_name,last_name from supercopy_test.children order by child_no')
      expect(result.rows).to.eql(
        [
          { child_no: 50, first_name: 'Todd', last_name: 'Flanders' },
          { child_no: 70, first_name: 'Milhouse', last_name: 'Van Houten' }
        ]
      )
    })
  })

  after('Cleanup the test data', async () => {
    await client.runFile(path.resolve(__dirname, path.join('fixtures', 'scripts', 'uninstall.sql')))
  })

  after('Close database connections', async () => {
    client.end()
  })
})
