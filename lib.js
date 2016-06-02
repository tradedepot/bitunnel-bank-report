"use strict";
/*
 * Lib
 */

let json2csv = require('json2csv'),
  fs = require('fs'),
  moment = require('moment'),
  request = require('request'),
  _ = require('underscore');

// Get Process Argurments
const getProcessArg = (i) => {
  return new Promise((r) => { r(process.argv[i]) });
}

// construct query data;
const getRequestOpt = (query) => {
  return {
    url: process.env.ES_URL || 'localhost:9201',
    method: 'POST',
    auth: {
      'user': process.env.ES_USER || 'user',
      'pass': process.env.ES_PASS || 'secret',
      'sendImmediately': false
    },
    body: query,
    json: true,
    strictSSL: false
  }
}

//make http request
const makeRequest = (opt) => {
  return new Promise((res, rej) => {
    request(opt, (error, response, body) => {
      if (!error) {
        res(body);
      } else {
        rej(error);
      }
    })
  })
}

//get Start and End Dates
const getDates = (date, flag) => {
    if (flag === "start") return moment(date).startOf('day').utc().toISOString() || "1970-01-01T00:00:00+00:00";
    else return moment(date).endOf('day').utc().toISOString() || "2099-12-31T23:59:00+00:00";
  }
  //Writes a json array to csv
const writeToCSV = (jsonArr, fileName) => {
  return new Promise((res, rej) => {
    let keys = _.keys(jsonArr[0]),
      size = _.size(jsonArr);
    json2csv({ data: jsonArr, fields: keys }, (err, csv) => {
      if (err) rej(err);
      fs.writeFile(fileName + '.csv', csv, (err) => {
        if (err) rej(err);
        res(`${size} records saved as  ${fileName}.csv`);
      });
    });
  })
}

// Export in native node, ES6 workaround
module.exports = {
  getProcessArg: getProcessArg,
  getOpt: getRequestOpt,
  getDates: getDates,
  makeRequest: makeRequest,
  writeToCSV: writeToCSV
}
