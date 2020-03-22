
const rp = require('request-promise');
const $ = require('cheerio');
const fs = require('fs-extra');

const config = require('./config.json');
const wordsToIgnore = config["wordsToIgnore"];
var resultsFile = require('./results.json');
var results = resultsFile;
var articles = [];


// PRIMORDIAL SCRAPPER 
// ADVANCED SCRAPPER NOT PUBLIC YET

const url = 'TARGET_DEST';

// Scraper must be adjusted to each page
rp(url)
    .then(function (html) {
        for (var i = 0; i < 49; i++) {
            var articleUrl = $('main > div > div > article > a', html)[String(i)]["attribs"]["href"];
            articles.push(articleUrl);
        }
    }).then(function () {
        articles.forEach(articleUrl => {
            rp(articleUrl).then(function (html) {
                var headline = $('article > div > header > h1', html).eq(0).text();
                var parsedHeadline = headline.toLowerCase()
                    .replace(/(~|`|’|‘|!|@|#|$|%|^|&|\*|\(|\)|{|}|\[|\]|;|"|´|:|\"|'|<|,|\.|>|\?|\/|\\|\||-|_|\+|=)/g, " ") // Removes punctuation
                    .replace(/\s+/g, ' ') // Strips extra spaces
                    .trim()
                    .split(" ")
                    .filter(term => !wordsToIgnore.includes(term));
                var verdict = $('article > div > div > div > div > h5', html).eq(0).text();
                if (parsedHeadline.includes("covid")) {
                    parsedHeadline.push("coronavirus", "virus", "covid19");
                }
                results["headlines"].push([parsedHeadline, verdict, headline, articleUrl]);            
            });
        })
    });

setTimeout(function() {
    fs.writeFile('./results.json', JSON.stringify(results));
},15000)