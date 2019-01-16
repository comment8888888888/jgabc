var http= require('http'),
    fs = require('fs'),
    vr = require("./verseRef.js"),
    incipits = require('./incipits.js').incipits;
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
var propria = {};
var partMap = {
  "Intr": "in",
  "Grad": "gr",
  "Tract": "tr",
  "All": "al",
  "Seq": "seq",
  "Offert": "of",
  "Comm": "co",
  "Missa": "ref"
}
var parts = Object.keys(partMap);
var regexPart = new RegExp(`^\\s*(?:(\\d+)\\s+)?(${parts.join('|')})\\.\\s+(.+)$`);
var weekdays = ["mon","tue","wed","thu","fri","sat"];
var regexWeekday = new RegExp(`^(.*?)_?(${weekdays.join('|')})$`);
var currentFeast = "";
var urls = ['propers','saints'];
var iUrl = 0;
processUrl(urls[iUrl++]);
function processUrl(urlKey) {
  var festa = {};
  if(!urlKey) return;
  var url = `http://www.gregorianbooks.com/${urlKey}.html`;
  http.get(url, result => {
    result.setEncoding('utf8');
    var fileData = '';
    var lastPercent = 0;
    result.on('data', data => {
      fileData += data;
      var percent = Math.floor(100 * fileData.length / result.headers["content-length"]);
      if(percent != lastPercent) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(percent.toString());
        if(percent == 100) process.stdout.write("\n");
      }
      lastPercent = percent;
    });
    result.on('close',e => console.info('socket closed on file: ' + file));
    result.on('aborted',e => console.info('ABORTED on file: ' + file));
    result.on('error',e => console.info('ERROR on file: ' + file));
    result.on('end', () => {
      

  var dom = new JSDOM(fileData, {url});
  var table = dom.window.document.querySelector('#main_table tbody')
  table.children.__proto__.forEach = Array.prototype.forEach;
  table.children.forEach(tr => {
    var td = tr.children[0];
    var a = td && td.querySelector("a[name]");
    var aHref = td && td.querySelector("a[href]");
    var sept = td && td.querySelector('.sept');
    var pasch = td && td.querySelector('.pasch');
    if(tr.children.length == 1) {
      if(!td.classList.contains("bar") &&
        !td.classList.contains("bar2") && a) {
        // new feast:
        if(currentFeast && !('ref' in propria) && !('in' in propria)) {
          delete festa[currentFeast];
        }
        propria = {};
        currentFeast = a.name;
        festa[a.name] = propria;
        propria.title = (td.querySelector('.greg0') || td).textContent.trim();
        let match = propria.title.match(/^(\d+)\s+(?:(or)\s+(\d+)\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+-/);
        if(match) propria.date = match[4] + match[1] + (match[2]||'') + (match[3]||'');
        var href = td.querySelector('.jib>a[href*="introibo.fr"]');
        if(href) {
          propria.href = href.href;
        }
      }
    } else {
      if(a || aHref) {
        var match = (a || aHref).textContent.match(regexPart);
        if(match) {
          var key = partMap[match[2]];
          if(sept) key += "Sept";
          if(pasch) key += "Pasch";
          if(match[1] || !(key in propria)) {
            var name = (match[3] || '').replace(/([a-z])([A-Z])/g,'$1 $2');
            if(/^ref/.test(key)) {
              var m = currentFeast.match(regexWeekday);
              if(m && m[1] in festa) {
                delete festa[currentFeast];
              }
              propria[key] = aHref.href.replace(/^http:\/\/www\.gregorianbooks\.com\//,'');
              return;
            } else {
              var incipitId = vr.findIncipitId(name,key);
              if(typeof incipitId == 'object' && (incipitId.length === 0 || Object.keys(incipitId).length === 0)) console.info(key, name, incipitId);
            }
            if(match[1]) {
              propria[key] = propria[key] || [];
              propria[key].push(name);
            } else {
              propria[key] = name;
            }
            var span = td.querySelector('span.ps1');
            if(span) {
              var ref = span.innerHTML.replace(/(\s)et(\s)/g,' & ').replace(/(\w)\s+(?=[,;:!\.?])/g,'$1').replace(/[\.;]?<br>\s*/g,'; ').replace(/<hr>/,'\n').trim();
              if(ref) {
                var refs = ref.split('\n').map(ref => vr.parseRef(ref).verseRefString());
                ref = refs[0];
                if(match[1]) {
                  propria[key+"Ref"] = propria[key+"Ref"] || [];
                  propria[key+"Ref"].push(ref);
                } else {
                  propria[key+"Ref"] = ref;
                }
                if(refs.length > 1) {
                  if(refs.length > 2) throw propria;
                  propria[key+"Verses"] = refs[1];
                }
              }
            }
          }
        }
      }
    }
  });

  fs.writeFileSync(`gregorian-${urlKey}.js`,`// from ${url}
gregorianPropers = ` + JSON.stringify(festa,null," "));

  processUrl(urls[iUrl++]);

    });
  });
}