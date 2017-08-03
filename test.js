 var fs = require('fs')

function writeDirRecursive(filename){
    let info= fileInfo(filename);
    
    var fullPath='.';
    for(var id in info.path){
      fullPath+='/'+info.path[id]
      if (!fs.existsSync(fullPath)){
        fs.mkdirSync(fullPath);
      }
    }
  }


  function fileInfo(filePath){
    var path=filePath.split(/[\\/]/);

    return {filePath:filePath,
      path:path,
      directory:path.slice(0,path.length-2).join("/"),
      name:path[path.length-1],
      encoding:undefined,
      file:undefined
    }
  }

writeDirRecursive('pdf2json/teste/teste2');
