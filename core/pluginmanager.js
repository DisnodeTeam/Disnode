var Logger       = require("disnode-logger");
const async      = require('async');
const fs         = require('fs-extra')
const jsonfile   = require('jsonfile');
const Stopwatch  = require('timer-stopwatch');
const merge      = require('merge');
const http = require('http');
const unzip = require('unzip');

var timer = new Stopwatch();

class PluginManager{
  constructor(disnode, server){
    this.server    = server;
    this.disnode   = disnode;
    this.instances = [];
    this.plugins   = [];

  }

  LoadAllPlugins(){
    var self = this;

    return new Promise(function(resolve, reject) {
      timer.start();
      self.instances.length = 0;
      self.plugins.length = 0;
      Logger.Info("PluginManager-"+self.server, "LoadAllPlugins", "Loading All Plugins!")

      async.waterfall([
        // Load Server Plugins
        function(cb){
          self.GetPluginFiles("./servers/"+self.server, true).then(function(plugins){

            if(!plugins){cb();return}
            for (var i = 0; i < plugins.length; i++) {
              self.plugins.push(plugins[i]);

            }
            cb();
          })
        },
        function(cb){
        //Load Default Plugins

          self.GetPluginFiles("./plugins/",false).then(function(plugins){

            if(!plugins){cb();return}

            for (var i = 0; i < plugins.length; i++) {

              var alreadyAdded = false;
              //Run Check for alreadyAdded plugins
              for (var x = 0; x < self.plugins.length; x++) {

                if(self.plugins[x].id == plugins[i].id){
                  alreadyAdded = true;
                }
              }

              if(!alreadyAdded){
                self.plugins.push(plugins[i]);
              }
            }
            cb();
          }).catch(cb);
        }
      ], function(err, res){

        timer.stop();

        Logger.Success("PluginManager-"+self.server, "LoadAllPlugins", "Loaded "+ self.plugins.length + " plugins in " + timer.ms + "ms!");
        timer.reset();
        resolve();
      })
    });
  }

  RunPluginMessage(pluginID, commandObject){

    var self = this;


    var plugin = self.GetInstanceByID(pluginID);

    if(!plugin){
      self.LaunchPlugin(pluginID, commandObject).then(function(launched){
        self.instances.push(launched);
        self.RunCommandBind(launched, commandObject);

      });
    }else{
      self.RunCommandBind(plugin, commandObject);

    }
  }

  LaunchPlugin(pluginID, commandObject){
    var self = this;
    Logger.Info("PluginManager-" + this.server, "LaunchPlugin", "Launching Plugin: " + pluginID);
    return new Promise(function(resolve, reject) {
      var pluginFile = self.GetPluginByID(pluginID);
      var _newPlugin = {};

      self.GetScriptRequire(pluginFile).then(function(requireClass){
        pluginFile.disnode = self.disnode;
        pluginFile.pluginManager = self;
        pluginFile.server = self.server;
        _newPlugin = merge(new requireClass(), pluginFile);


        return self.GetConfigFile(_newPlugin)
      }).then(function(config){
        _newPlugin.config = config;
        return self.GetCommandFile(_newPlugin);
      }).then(function(commands){
        _newPlugin.commands =commands;

        if(_newPlugin.Init){
          _newPlugin.Init(function(){
            resolve(_newPlugin);
          })
        }else{
          resolve(_newPlugin);
        }
      }).catch(function(err){
        console.log(err);
        reject(err);
      })

    });
  }

  RunCommandBind(plugin, messageObject){

    var commandObj = this.GetCommandObject(plugin, messageObject.command);

    if(!plugin[commandObj.run]){
      Logger.Warning("PluginManager-" + this.server, "RunCommandBind", "No Function Found for: " + commandObj.run);
      return;
    }
    plugin[commandObj.run](messageObject);

  }

  AddServerPlugin(pluginId, cb){
    var self = this;
    return new Promise(function(resolve, reject) {
      self.command   = self.disnode.server.GetCommandInstance(self.server);
      self.MakeServerFolder();
      var newPath ="servers/"+self.server;

      var request = http.get("http://www.disnodeteam.com/api/plugins/download/"+pluginId, function(response) {
        response.pipe(unzip.Extract({ path: newPath }));
        response.on("end", function(){
        setTimeout(function () {
          self.LoadAllPlugins().then(function(){
            self.command.UpdateAllPrefixes();
            resolve();
          });

         }, 1000);
       })

     });
    });
  }

  RemoveServerPlugin(pluginId){
    var self = this;
    self.MakeServerFolder();
    for (var i = 0; i < self.plugins.length; i++) {
     if(self.plugins[i].isServer == false){

       return;
     }

     if(self.plugins[i].id == pluginId){
       var newPath =self.plugins[i].path.replace("plugins/", "servers/"+this.server);


       fs.remove(self.plugins[i].path, err => {
       	if (err) return console.error(err)
        this.LoadAllPlugins();

       })
     }

    }
  }

  MakeServerFolder(){
    var dir = "./servers/"+this.server;
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }

  }

  GetPluginByID(pluginID){
    for (var i = 0; i < this.plugins.length; i++) {
      if(this.plugins[i].id == pluginID){return this.plugins[i]}
    }
  }

  GetInstanceByID(pluginID){
    for (var i = 0; i < this.instances.length; i++) {

      if(this.instances[i].id == pluginID){return this.instances[i]}
    }
  }

  GetPluginFiles(path, isServer){

    var self = this;
    return new Promise(function(resolve, reject) {
      var Plugins = [];
      var folders= ""
      try {
        folders = fs.readdirSync(path);
      } catch (e) {
        resolve();
      }


      async.each(folders, function(_folder, cb){

        jsonfile.readFile(path + "/" + _folder + "/plugin.json", function(err,obj){
          if(!err){
            obj.path = path + "/" + _folder;
            obj.isServer = isServer;

            Plugins.push(obj);
            cb();
            return;
          }else{
            Logger.Warning("PluginManager-"+self.server, "GetPluginFolders", "Error Finding plugin.json file: " + _folder)
            cb();
            return;
          }
          cb();
        })

      }, function(err, res){

        resolve(Plugins)
      })
    });

  }


  GetCommandPrefixes(){
    var self = this;
    return new Promise(function(resolve, reject) {

      var prefix = [];

      async.each(self.plugins, function(plugin,cb){

        self.GetConfigFile(plugin).then(function(config){

          prefix.push({plugin: plugin.id, prefix: config.prefix});
          cb();
        }).catch(function(err){

          cb(err);
        });
      }, function(err, res){
        if (err) reject(err);

        resolve(prefix);
      })

    });
  }
  GetCommandObject(plugin, commandString){
    var _cmds = plugin.commands || [];
    var _found;
    for (var i = 0; i < _cmds.length; i++) {
      if(_cmds[i].cmd == commandString){
        _found = _cmds[i];
      }
    }

    if(_found){
      return _found;
    }else{
      return {cmd: commandString, run: "default"}
    }
  }
  GetConfigFile(plugin){
    return new Promise(function(resolve, reject) {
      if(!plugin.configFile){
        reject("No Config Set");
        return;
      }

      jsonfile.readFile(plugin.path + "/"+plugin.configFile, function(err, obj){
        if(err){
          reject(err);
          return
        }
        resolve(obj);
      });
    });
  }

  GetCommandFile(plugin){
    return new Promise(function(resolve, reject) {
      if(!plugin.commandsFile){
        reject("No Command Set");
        return;
      }

      jsonfile.readFile(plugin.path + "/"+plugin.commandsFile, function(err, obj){
        if(err){
          console.log(err);
          reject(err);
          return
        }

        resolve(obj.commands);
      });
    });
  }

  SetConfigFile(plugin, config){
    return new Promise(function(resolve, reject) {
      if(!plugin.configFile){
        reject("No Config Set");
        return;
      }

      jsonfile.writeFile(plugin.path + "/"+plugin.configFile, config, function(err){
        if(err){
          reject(err);
          return
        }
        resolve();
      });
    });
  }

  SetCommandFile(plugin, commands){
    return new Promise(function(resolve, reject) {
      if(!plugin.commandsFile){
        reject("No Command Set");
        return;
      }

      jsonfile.writeFile(plugin.path + "/"+plugin.commandsFile, commands, function(err){
        if(err){
          console.log(err);
          reject(err);
          return
        }

        resolve();
      });
    });
  }

  GetScriptRequire(plugin){
    return new Promise(function(resolve, reject) {
      if(!plugin.script){
        reject("No Script Set");
        return;
      }

      var className = plugin.script;
      var path = plugin.path + "/" + className;
      async.waterfall([
          // Check if class exists
          function(callback) {
              Logger.Info("PluginManager", "Load-"+plugin.name, "Checking for class");
              fs.stat(path, function(err, stats) {
                  if (err) {
                      Logger.Error("PluginManager", "Load-"+plugin.name, "Failed to find Class (" + path + ")");
                      callback(err);
                      return;
                  } else {
                      Logger.Success("PluginManager", "Load-"+plugin.name, "Found Class");
                      callback();
                  }
              });
          },
          // Attempt to import the class
          function(callback) {
            Logger.Info("PluginManager", "Load-"+plugin.name, "Trying to import class");
              try {
                  var NpmRequire = require("../" + path);

                  Logger.Success("PluginManager", "Load-"+plugin.name, "Imported");

                  callback(null,NpmRequire);
              } catch (e) {
                Logger.Error("PluginManager", "Load-"+plugin.name, "Failed to Import: " + className + " - '" + e  + "'");
                callback(e, null);
              }
          },
      ], function(err, result) {
          if(err){
            console.log(err);
            reject(err);
            return;
          }

          resolve(result);

      });

    });
  }

}

module.exports = PluginManager;
