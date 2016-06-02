'use strict';

let lib = require("./lib"),
  _ = require('underscore'),
  reportType, sourceName,
  mustNot, must,
  startDate, endDate;

const getBankQuery = (sourceName) => {
  sourceName = sourceName || 'nibss';

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

  return {
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
}

const getNAVQuery = (sourceName) => {
  sourceName = sourceName || 'nibss';

  switch (sourceName) {
    case 'fbn':
      must = "First";
      mustNot = "Default";
      break;
    case 'nibss':
    default:
      must = "Default";
      mustNot = "First";
  }

  return {
    "from": 0,
    "size": 1000,
    "sort": [{
      "@timestamp": { "order": "desc" }
    }],
    "query": {
      "bool": {
        "must": [
          { "match": { "log": "navtdctransaction" } },
          { "match": { "log": "CamelHttpMethod=POST" } },
          { "match": { "log": must } },
          { "match": { "kubernetes.container_name": "bitunnel*png" } }, {
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
          { "match": { "log": "BNK-" } }
        ]
      }
    }
  }
}


// Parse BANK to NAV result to requested format
const parseBankResult = (data) => {
  return new Promise((res, rej) => {
    let result = []
    if (data && data.hits) {
      data = data.hits.hits;
      _.each(data, (d) => {
        let tempObj, trxObj, source = d._source,
          timestamp = source['@timestamp'],
          log = source.log,
          logArr = log.split('bitunnel-break');

        if (_.size(logArr) > 1) {
          tempObj = JSON.parse(logArr[1].trim());
          tempObj.warehouseCode = tempObj.warehouseCode || '';
          tempObj.orderNumber = tempObj.orderNumber || '';
          delete tempObj.transactionID;
          trxObj = { timestamp: timestamp };
          result.push(_.extend(trxObj, tempObj));
        }
      });
      res(result);
    } else {
      rej(data);
    }
  })
}

// Parse NAV to TDC  result to requested format
const parseNAVResult = (data) => {
  return new Promise((res, rej) => {
    let result = []
    if (data && data.hits) {
      data = data.hits.hits;
      _.each(data, (d) => {
        let tempObj, trxObj, source = d._source,
          timestamp = source['@timestamp'],
          log = source.log,
          logArr = log.split('navtdctransaction');
        if (_.size(logArr) > 1) {
          tempObj = JSON.parse(logArr[1].trim());
          let narrationArr = tempObj.narration.split('|');
          tempObj.navDocumentNo = tempObj.originDocumentNo;
          tempObj.customer = narrationArr[1].trim();
          tempObj.reference = narrationArr[0].trim();
          delete tempObj.currency;
          delete tempObj.originDocumentNo;
          delete tempObj.postingDate;
          delete tempObj.transactionType;
          trxObj = { timestamp: timestamp };
          result.push(_.extend(trxObj, tempObj));
        }
      });
      res(result);
    } else {
      rej(data);
    }
  })
}

//Synchronously perform all operations
lib.getProcessArg(2)
  .then((a) => {
    reportType = a;
    return lib.getProcessArg(3)
  })
  .then((a) => {
    sourceName = a;
    return lib.getProcessArg(4)
  })
  .then((b) => {
    startDate = lib.getDates(b, 'start');
    return lib.getProcessArg(5)
  })
  .then((c) => {
    c = c || startDate;
    endDate = lib.getDates(c, 'end');
    return `Generating ${reportType} report for ${sourceName} from ${startDate} to ${endDate}`;
  })
  .then((d) => {
    console.log(`\n----------------------\n ${d} \n------------------------\n`);
    return lib.makeRequest(lib.getOpt(reportType === "bank" ? getBankQuery(sourceName) : getNAVQuery(sourceName)))
  })
  .then((d) => {
    return reportType === "bank" ? parseBankResult(d) : parseNAVResult(d);
  })
  .then((f) => {
    return lib.writeToCSV(f, `${sourceName}-middleware-${reportType}-report`);
  })
  .then((g) => {
    console.log(`${g} \n=============================\n`);
  })
  .catch((e) => {
    console.log(e);
  });
