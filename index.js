'use strict';

let json2csv = require('json2csv'),
  fs = require('fs'),
  request = require('request'),
  _ = require('underscore'),
  sourceName,
  mustNot, must,
  startDate, endDate;

sourceName = process.argv[2] || "nibss";
startDate = process.argv[3] || "2016-05-27T09:00:00+00:00";
endDate = process.argv[4] || "2016-05-27T23:59:00+00:00";

switch (sourceName) {
  case 'fbn':
    must = "api.tradedepot.io";
    mustNot = "172.20.0.248";
    break;
  case 'nibss':
  default:
    must = "172.20.0.248";
    mustNot = "api.tradedepot.io";
}

//elastic search query
let elastic_search_query = {
  "from": 0,
  "size": 1000,
  "sort": [{
    "@timestamp": { "order": "desc" }
  }],
  "query": {
    "bool": {
      "must": [
        { "match": { "log": "incoming-" } },
        { "match": { "log": "deposit" } },
        { "match": { "log": "CamelHttpMethod=POST" } },
        { "match": { "log": must } },
        { "match": { "kubernetes.container_name": "bitunnel*banking" } }, {
          "range": {
            "@timestamp": {
              "gte": startDate,
              "lte": endDate
            }
          }
        }
      ],
      "must_not": [
        { "match": { "log": mustNot } }
      ],
      "should": [
        { "match": { "log": "warehouse" } }
      ]
    }
  }
}

let opt = {
  url: process.env.ES_URL || 'localhost:9201',
  method: 'POST',
  auth: {
    'user': process.env.ES_USER || 'user',
    'pass': process.env.ES_PASS || 'secret',
    'sendImmediately': false
  },
  body: elastic_search_query,
  json: true,
  strictSSL: false
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

// Parse result to requested format
const parseResult = (data) => {
  return new Promise((res, rej) => {
    let result = []
    data = data.hits.hits;
    _.each(data, (d) => {
      let tempObj, trxObj, source = d._source,
        timestamp = source['@timestamp'],
        log = source.log,
        logArr = log.split('bitunnel-break');

      if (_.size(logArr) > 1) {
        tempObj = JSON.parse(logArr[1].trim());
        trxObj = tempObj;
        trxObj.warehouseCode = trxObj.warehouseCode || '';
        trxObj.orderNumber = trxObj.orderNumber || '';
        result.push(_.extend(trxObj, { timestamp: timestamp }));
      }
    });
    res(result);
  })
}

//Writes a json array to csv
const writeToCSV = (jsonArr, fileName) => {
  return new Promise((res, rej) => {
    let keys = _.keys(jsonArr[0]);
    json2csv({ data: jsonArr, fields: keys }, (err, csv) => {
      if (err) console.log(err);
      fs.writeFile(fileName + '.csv', csv, (err) => {
        if (err) rej(err);
        res(`file saved as  ${fileName}.csv`);
      });
    });
  })
}

//Ayschronously perform all operations
makeRequest(opt)
  .then((a) => {
    return parseResult(a);
  })
  .then((b) => {
    return writeToCSV(b, `${sourceName}-middleware-report`);
  }).then((c) => {
    console.log(c);
  })
  .catch((e) => {
    console.log(e);
  });
