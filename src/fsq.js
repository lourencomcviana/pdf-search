//Puts fs asyn operations inside Promises
(function() {
  var fs = require('fs');
  var glob = require("glob")
  var Promise = require("bluebird");

 

  module.exports = {
    readFile:readFile,
    readFilesGlob:readFilesGlob,
    writeFile:writeFile,
    writeFiles:writeFiles,
    setDefaultEncoding:setDefaultEncoding
  };

  var defaultEncoding='UTF-8';

  function setDefaultEncoding(value){
    defaultEncoding=value;
  }


  function fileInfo(filePath){
    let saida={filePathStr:filePath,
      filePath:filePath.split(/[\\/]/),
      directoryStr:undefined,
      directory:undefined,
      name:undefined,
      encoding:undefined,
      file:undefined
    }
    saida.directory=saida.filePath.slice(0,saida.filePath.length-1);

    saida.directoryStr=saida.directory.join("/");
    saida.name=saida.filePath[saida.filePath.length-1]
    return saida;
  }

  
  function readFile(filename,encoding){
    if(!encoding) encoding=defaultEncoding;
    return new Promise(function (fulfill, reject){
      fs.readFile(filename, function (err, res){
        if (err) reject(err);
        else{ 
          let info= fileInfo(filename)
          info.encoding=encoding;
          info.file=res;
          fulfill(info);
        };
      });
    });
  }

  function writeDirRecursive(filename){
    let info= fileInfo(filename);
    
    var fullPath='.';
    for(var id in info.directory){
      fullPath+='/'+info.directory[id]
      if (!fs.existsSync(fullPath)){
        fs.mkdirSync(fullPath);
      }
    }
    
  }

  function writeFile(filename,content,encoding){
    if(!encoding) encoding=defaultEncoding;
    return new Promise(function (fulfill, reject){
      writeDirRecursive(filename);
      fs.writeFile(filename, content,encoding, function (err){
        if (err) reject(err);
        else fulfill(filename);
      });
    });
  }

  async function writeFiles(files,formater,progressCallback){
    progress=new Progress(progressCallback,'escrevendo arquivos')
    progress.start(files.length);
    var promisses=[];

    for(var id in files){
      progress.run();
      let file=files[id].file;
      if(formater){
        file=formater(file)
      }
      promisses.push(
        writeFile(files[id].filePathStr,file)
      );
      //controle para impedir estouro de pilha
      if(files.length>1000)await sleep(20);

    }
    
    return Promise.all(promisses);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function readFilesGlob(globPath,options,progressCallback){

    return new Promise(function (fulfill, reject){
      progress=new Progress(progressCallback,'lendo arquivos')
      glob(globPath, options, function (err, files) {
        function FilePaging(files,options){
          
          let arr=[];
          if(!options)options={}
          if(!options.size)options.size=100

          arr.paging={
            size:options.size,
            total:Math.floor(files.length/100),            
            current:0,
            files:files,
            format:options.format,
            hasNext:function(){
              return (arr.paging.current<arr.paging.total)
            },
            hasPrevious:function(){
              return (arr.paging.current>0)
            }
          }
          arr.addFiles = function(files){
            arr.paging.files.concat(files);
          }

          
          arr.next=function(){
            if(arr.paging.hasNext()){
              arr.paging.current++;
              loadFiles(arr);
              return true;
            }
          }
          arr.previous=function(){
            if(arr.paging.hasPrevious()){
              arr.paging.current--;
              loadFiles(arr);
               return true;
            }
          }

          function loadFiles(arr){
            arr.splice(0,arr.length);
            progress=new Progress(progressCallback,'carregando pagina')
            progress.start(arr.paging.size);

            let itens=arr.paging.size*arr.paging.current;
            let maxItens=itens+arr.paging.size;
            if(maxItens>arr.paging.files.length){
              maxItens=arr.paging.files.length;
            }
                        
            for(itens;itens<maxItens;itens++){

              let filePackage=fileInfo(arr.paging.files[itens]);
              filePackage.file=fs.readFileSync(arr.paging.files[itens]);
              let formatReturn;
              if(arr.paging.format) {
                //se format for async?
                formatReturn=arr.paging.format(filePackage);
                if(!formatReturn)formatReturn=filePackage;
                if(formatReturn.then){arr.paging.hasPromise=true;}
              }else{
                formatReturn=filePackage;
              }

              arr.push(formatReturn);
              progress.run();
            }
          }
          loadFiles(arr);
          return arr;   
        }

        async function readAllFiles(files){
          var readPromisses=[];

          if(options.exceptions){
            let newFiles=[];
            for(var id in files){
              if(options.exceptions.indexOf(files[id])==-1){
                newFiles.push(files[id]);
              }
            }
            files=newFiles;
          }
          if(files.length>0){
            readPromisses=FilePaging(files,options);
            return readPromisses;
          }else{
            progress.start(files.length);
            for(var id in files){

              readPromisses.push(readFile(files[id]).then(
                function(data){
                  progress.run();
                  return data;
              }));
              
            }
            return Promise.all(readPromisses);
          
          }
        }
        readAllFiles(files).then(function(data){
          fulfill(data);
        })

      });
    });
  }

  function Progress(progress,description){
    this.description=description;
    this.total=0;
    this.exec=0;
    this.progress=progress;
    this.state=0;
    this.showStatistcs=false;
    this.states=function(state){
      let statesEnum= ['CREATED','STARTED','RUNNING','FINISHED','FINISHED BUT STILL RUNNING'];
      if(!state)
        return statesEnum;
      else
        return statesEnum[this.state];
    }
    this.time={
      start:new Date().toISOString(),
      first:undefined,
      end:undefined
    }

    this.start=function(totalLength){
      if(this.progress){
        this.exec=0;
        this.total=Number(totalLength);
        
        this.time.first=new Date().toISOString();
        if(this.total==0 || !this.total){
          this.state=3
          this.time.end=new Date().toISOString();
        }
        else
          this.state=1;
        this.progress(this);
      }
    }

    this.run=function(){
      if(this.progress){
        this.exec++; 
        if(this.total==this.exec){
          this.state=3;
          this.time.end=new Date().toISOString();
        }else if(this.total<this.exec){
          this.state=4;
        }
        else{
          this.state=2;
        }
        this.progress(this);
      }
    }

    this.show=function(){
      if(this.progress){
        process.stdout.clearLine();
        process.stdout.cursorTo(0);

        if(this.state) process.stdout.write(this.states(this.state)+' ')
        if(this.description)  process.stdout.write(this.description+' ');
        
        process.stdout.write(this.exec+"/"+this.total);
        if(this.state===3){
          this.showEnd();
        }
      }
    }
    this.showEnd=function(){
      if(this.progress){
        if(this.showStatistcs){
          process.stdout.write('\nstart: '+this.time.start)
          process.stdout.write('\nfirst: '+this.time.first)
          process.stdout.write('\nend:   '+this.time.end)
        }
        process.stdout.write('\n');
      }
    }

  }
}());