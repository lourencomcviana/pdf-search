//Puts fs asyn operations inside Promises
(function() {
  var fs = require('fs');
  var glob = require("glob")
 

  module.exports = {
    readFile:readFile,
    readFilesGlob:readFilesGlob,
    writeFile:writeFile,
    setDefaultEncoding:setDefaultEncoding
  };

  var defaultEncoding='UTF-8';

  function setDefaultEncoding(value){
    defaultEncoding=value;
  }

  function readFile(filename,encoding){
    if(!encoding) encoding=defaultEncoding;
    return new Promise(function (fulfill, reject){
      fs.readFile(filename, function (err, res){
        if (err) reject(err);
        else{ 
          var path=filename.split(/[\\/]/);
          fulfill({path:path,name:path[path.length-1],fullPath:filename,encoding:encoding,file:res})
        };
      });
    });
  }

  function writeFile(filename,content,encoding){
    if(!encoding) encoding=defaultEncoding;
    return new Promise(function (fulfill, reject){
      fs.writeFile(filename, content,encoding, function (err){
        if (err) reject(err);
        else fulfill(filename);
      });
    });
  }

  function readFilesGlob(globPath,options){
    return new Promise(function (fulfill, reject){
      glob(globPath, options, function (err, files) {
        if (err) reject(err);
        else {
          var readPromisses=[];
          for(var id in files){
            readPromisses.push(readFile(files[id]));
          }
          Promise.all(readPromisses).then(
            function(filesContents){
              fulfill(filesContents)
            },
            function(err){
              reject(err)
            }
          );  
        };
      })
    })
  }
}());