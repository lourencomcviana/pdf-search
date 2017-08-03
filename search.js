 var fs = require('fs'),
  PDFParser = require("pdf2json");
var fsq= require('./src/fsq');
var Promise = require("bluebird");


console.log('iniciando app');

var search=new Search();

var jsonFiles='pdf2json';
//node search.js -c pdfs/**/*.pdf
if(process.argv[2]=='-c'){
  search.pdfToJsonSource(process.argv[3],jsonFiles)
}else{
  search.runSearch(jsonFiles)
}
//;
//search.runSearch();

function Search(){
  
  this.terms=undefined;
  this.sources=undefined;
  this.path={
    search:undefined,
    json:[],
    pdf:[]
  };

  this.runSearch = function(){
    var termo=search.loadTermsFromFile('search.json');
    var json=search.loadJsonSources('pdf2json/**/*.json');
    Promise.all([json,termo])
    .then(function(data){
      console.log('Iniciando busca')
      return report(data[0],data[1]);
    },showPromissseError)
    .then(function(data){
      console.log('escrevendo arquivo')
      return fsq.writeFile("./search.report.json", JSON.stringify(data,null,2))
    },showPromissseError).then(function(){
      console.log('terminou!');
    },showPromissseError)
  }

  this.loadTermsFromFile=function(file){
    var promisse=fsq.readFile(file).then(
      function(files){
        return JSON.parse(files.file);
      },showPromissseError
    );
    //this.path.search=file;

    if(this.terms)
      this.terms=Promise.all([this.terms,promisse]);
    else
      this.terms=promisse;

    return promisse;
  };

  this.loadJsonSources=function(globPath){
    this.sources=fsq.readFilesGlob(globPath,{nocase:true,
      format:function(data){
        data.file=JSON.parse(data.file)
        return data;
      }
    },function(progress){progress.show()}).then(
      function(files){

        return files;
        
      },showPromissseError
    );
    return this.sources;
  }

  this.pdfToJsonSource=function(globPath,savePath){
   
    var sources=search.loadJsonSources(savePath+'/**/*.json');
    if(sources){
      var writePromisse= sources.then(function(sourceFiles){
        return readPdfWriteJson(sourceFiles);
      }
      ,showPromissseError);

      //a nova promessa nova é a soma do resultado antigo mais o novo
      return Promise.all([writePromisse,sources]).then(function(data){
        return data[1].concat(data[0]);
      })
    }
    else{
      return readPdfWriteJson([]);
    }

    function readPdfWriteJson(alredyReadFiles){
      console.log('reading  pdf');

      //lista de pdfs que não precisam ser lidos denovo
      exceptions=[];
      for(var id in alredyReadFiles.paging.files){
        var jsonFileName=alredyReadFiles.paging.files[id];

        let name=jsonFileName.substr(0,jsonFileName.length-5);

        name=name.substr(savePath.length+1);
        exceptions.push(name);
      }

      let writePromisses=
      fsq.readFilesGlob(globPath,
        {
          exceptions:exceptions,
          nocase:true,
          format:function(data){
            return parsePdf(data.file,data)
              .then(function(parsedPdf){

                if(typeof parsedPdf.file=='string')
                  parsedPdf.file=JSON.parse(parsedPdf.file);
                parsedPdf.filePathStr="./"+savePath+'/'+parsedPdf.filePathStr+".json";
                return parsedPdf;
              },showPromissseError)
          }
        },
        function(progress){
          progress.show();
        }
      ).then(
        function(files){

          var writePromisses=[]

          write(files)

          function write(files){
            if(files.length>0){
              return Promise.all(files).then(function(data){
                console.log('escrevendo página: '+files.paging.current+' de '+files.paging.total)
                fsq.writeFiles(data,
                  function(data){
                    return JSON.stringify(data,null,2);
                  }
                  ,
                  function(report){
                    report.show()
                  }
                ).then(function(){
                  if(files.paging.hasNext()){
                    files.next();
                    write(files);
                  }
                });
              });
            }
          }

          return files;
            
        },showPromissseError
      );

      return writePromisses;
    }
  }
}


function report(jsonFiles,searchArray){

  //resetProgress(jsonFiles.paging.files);
  var newListJson={}

  var cagados=[];
  do{
 
    console.log('página: '+jsonFiles.paging.current+' de '+jsonFiles.paging.total)
    for(var fileId in jsonFiles){
      if(isNaN(fileId)) continue;
      try{
        //runProgress('processando '+jsonFiles[fileId].name)
        let name=jsonFiles[fileId].filePath.slice(1).join("/");
        name=name.substr(0,name.length-5);
        if(!newListJson[jsonFiles[fileId].name]){
          
          newListJson[name]=[]
        }
        let file=jsonFiles[fileId].file;
        
        
        for(var id in file.formImage.Pages){
          let page=file.formImage.Pages[id];
          for(var idText in page.Texts){
            let text=page.Texts[idText].R[0].T;
            
            if(text=='N%C3%9AMERO%20DO%20TERMO%3A'){
              text=page.Texts[(Number(idText)+1)].R[0].T;
              newListJson[name].push(text)
            }
          }
        }
      }catch(e){
        
        cagados.push({err:e,fileId:fileId});
      }
    }

  } while(jsonFiles.next());
  if(cagados.length>0){
    console.log('ERROS!!!!')
    //console.log(cagados);
  }
  return newListJson
}
  

var progress=0;
var progressTotal=0;

function resetProgress(array){
  progress=0;
  progressTotal=array.length;
}

function runProgress(text){
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  progress++;
  process.stdout.write(text+progress+"/"+progressTotal);
  if(progress==progressTotal){
    process.stdout.write('\n');
  }
}



function showPromissseError(err){
  console.error(err);
}


function parsePdf(pdfBuffer,fileInfo){
  return new Promise(function (fulfill, reject){
    var pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", errData =>  reject(errData ));
    pdfParser.on("pdfParser_dataReady", pdfData => {
      fileInfo.file=pdfData;
      fulfill(fileInfo);
      //runProgress('processando arquivos pdf -> ');
    });
    pdfParser.parseBuffer(pdfBuffer);

  });
}

