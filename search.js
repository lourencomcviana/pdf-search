 var fs = require('fs'),
  PDFParser = require("pdf2json");
//var readline = require('readline');

var fsq= require('./src/fsq');

var pdf2jsonFolder='pdf2json';
var loadedFiles;
var jsonFiles;

var termoList=["2016570017631",2016570017620,2016570026065]

console.log('iniciando app');
var search=new Search();

var termo=search.loadTermsFromFile('search.json');

var json=search.pdfToJsonSource('pdfs/../*.pdf',"pdf2json");

//busca
Promise.all([json,termo])
  .then(function(data){
    console.log('Iniciando busca')
    return find(data[0],data[1]);
  },showPromissseError)
  .then(function(data){
    console.log('escrevendo arquivo')
    return fsq.writeFile("./search.result.json", JSON.stringify(data,null,2))
  },showPromissseError).then(function(){
    console.log('terminou!');
  },showPromissseError)

function Search(){
  
  this.terms=undefined;
  this.sources=undefined;
  this.path={
    search:undefined,
    json:[],
    pdf:[]
  };

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
    this.sources=fsq.readFilesGlob(globPath,{nocase:true}).then(
      function(files){
        // console.log('buscando por aquivos processados');
        for(var id in files){
          files[id].file=JSON.parse(files[id].file);
        }
        return files;
        
      },showPromissseError
    );
    return this.sources;
  }

  this.pdfToJsonSource=function(globPath,savePath){
    var sources=search.loadJsonSources(savePath+'/*.json');
    
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

      let writePromisses=
      fsq.readFilesGlob(globPath,{nocase:true}).then(
        function(files){
          resetProgress(files)
          var promisses=[];
          for(var id in files){
            if(!alredyReadFiles.find(
              function(obj){
                return obj.name==files[id].name+'.json';
              })
            ){

              promisses.push(
                parsePdf(files[id].file,files[id].name)
                .then(function(parsedPdf){
                  runProgress('convertendo pdf')
                  //the promise of the writem file dosent matter since we have the result right here
                  var writeData=JSON.stringify(parsedPdf.json,null,2);
                  console.log("./"+savePath+parsedPdf.name+".json");
                  fsq.writeFile("./"+savePath+'/'+parsedPdf.name+".json", writeData);
                  
                  return parsedPdf.json;
                },showPromissseError)
              );
            }
          }
          return Promise.all(promisses);
            
        },showPromissseError
      );

      return writePromisses;
    }
  }
}


function find(jsonFiles,searchArray){
  var termosFound={};

  resetProgress(jsonFiles)
  for(var fileId in jsonFiles){
    let file=jsonFiles[fileId].file;
    runProgress('processando '+jsonFiles[fileId].name+' ')
    
    for(var id in file.formImage.Pages){
      let page=file.formImage.Pages[id];
      for(var idText in page.Texts){
        let text=page.Texts[idText].R[0].T;
        for(var idSearch in searchArray){
          //if(text.match(searchArray[idSearch])){
          if(text==(searchArray[idSearch])){
            if(!termosFound[text])termosFound[text]=[];
            if(termosFound[text].indexOf(jsonFiles[fileId].name)<0){
                termosFound[text].push(jsonFiles[fileId].name);
            }
          }
        }
      }
    }
  }
  return termosFound;
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


function parsePdf(pdfBuffer,name){
  return new Promise(function (fulfill, reject){
    var pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", errData =>  reject(errData ));
    pdfParser.on("pdfParser_dataReady", pdfData => {
      fulfill({json:pdfData,name:name});
      //runProgress('processando arquivos pdf -> ');
    });
    pdfParser.parseBuffer(pdfBuffer);

  });
}

