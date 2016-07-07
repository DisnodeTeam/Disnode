"use strict";
const EventEmitter = require("events");
const Discord = require( "discord.js");

const DisnodeAudioPlayer = require("./AudioPlayer.js");
const CommandHandler = require("./CommandHandler.js");
const DisnodeVoiceManager = require("./VoiceManager.js");
const DisnodeBotCommunication = require("./BotCommunication.js");
const CleverManager = require("./CleverManager.js");
const ConfigManager = require("./ConfigManager.js");
const Wolfram = require("./Wolfram.js");
const YoutubeManager = require("./YoutubeManager.js");
const DiscordManager = require("./DiscordManager.js");

class Disnode extends EventEmitter{
  constructor(key){
    super();

    this.key = key;
  }

  startBot(){
    var self = this;

    this.bot = new Discord.Client();


    this.bot.loginWithToken(this.key);

    this.bot.on("ready", () => this.botReady())
    this.bot.on("message", (msg) => this.botRawMessage(msg));


    this.botInit();

  }

  botInit()
  {
    var self = this;
    this.emit("Bot_Init");

  }

  botReady(){
    var self = this;
    self.emit("Bot_Ready");
  }

  botRawMessage(msg){
    var self = this;
    self.cleverMessage(msg);
    if(self.CommandHandler){
      self.CommandHandler.RunMessage(msg);
    }
    this.emit("Bot_RawMessage", msg);
  }

  addManager(data){
    var self = this;
    var path;
    var option = data.options;
    option.disnode = self;

    if(data.path){
      path = data.path;
    }else{
      path = "./"+data.name+".js";
    }

    self[data.name] = {};
    self[data.name].package = require(path);
    self[data.name] = new self[data.name].package(option);

  }
  postLoad(){
    var self = this;
    if(self.CommandHandler){
      this.CommandHandler.AddContext(self, "disnode");
    }
    //console.dir(self.YoutubeManager);
  }

  addDefaultCommands(){
    var self = this;
    if(!self.CommandHandler.list){
      self.CommandHandler.list = [];
    }
    self.CommandHandler.UpdateList(self.CommandHandler.list);
  }


  enableBotCommunication(options){
    var self = this;
    if(!self.communication){
      self.communication = {};
    }

    self.communication.manager = new DisnodeBotCommunication(self.bot.user.id);
    self.communication.manager.Start();
  }
  cmdDownloadYT(parsedMsg) {
    var msg = parsedMsg.msg.content;
    var self = this;

    var firstSpace =msg.indexOf(" ");
    var link = msg.substring(firstSpace + 1, msg.indexOf(" ", firstSpace + 1));
    var file = msg.substring(msg.indexOf(" ",msg.indexOf(link)) + 1,msg.length);

    var progressMessage;



    self.bot.sendMessage(parsedMsg.msg.channel, "``` Video Code: "+link+" Command Name: "+file+"```" );
    self.bot.sendMessage(parsedMsg.msg.channel, "``` Downloading... ```", function(err, sent) {
      progressMessage = sent;
      console.log(err);
    });

    self.YoutubeManager.SetOnFinished(function(data){
      self.bot.updateMessage(progressMessage, "``` Finished. Use '" + self.CommandHandler.prefix + "play "+file+"'```");
    });
    self.YoutubeManager.SetOnError(function(error){
      self.bot.updateMessage(progressMessage, error);
    });
    self.YoutubeManager.SetOnProgess(function(progress){
      console.log(progress.progress.percentage);
      if(progress.progress.percentage != 100){
        var percent = Math.round(progress.progress.percentage);
        //bot.updateMessage(progressMessage, "```Downloading..."+percent + "%```");
      }
    });
    self.YoutubeManager.Download(link, file);
  }
  cmdWA(parsedMsg){
    var self = this;
    if(!self.Wolfram){
      self.bot.sendMessage(parsedMsg.msg.channel, "Wolfram is not enabled on this bot");
      return;
    }

    var wolfmsg;
  	self.bot.sendMessage(parsedMsg.msg.channel, "``` Waiting on Wolfram API Q: " + parsedMsg.params[0] +" Options: " + parsedMsg.params[1] + " " + parsedMsg.params[2] + " ```", function(err, sent) {
  		wolfmsg = sent;
  		console.log(err);
  	});
  	self.Wolfram.makeRequest(parsedMsg.params, "img", function(text){
      if(text === "NO_QUESTION"){
        console.log("[Wolfram] No Question!");
        self.bot.updateMessage(wolfmsg, "```You didn't put a question in for wolfram to answer!```");
      }else if(text === "LOOKUP_ERROR"){
        self.bot.updateMessage(wolfmsg, "```There was an error when looking up your question sorry!```");
      }else{
        self.bot.updateMessage(wolfmsg, text);
      }
  	});
  }
  cmdCLEVER(parsedMsg){
    var self = this;
    if(!self.CleverManager){
      self.bot.sendMessage(parsedMsg.msg.channel, "Cleverbot is not enabled on this bot");
      return;
    }

    if(parsedMsg.params[0] == "new"){
      self.CleverManager.cb = new Cleverbot;
      self.bot.sendMessage(parsedMsg.msg.channel, "```Cleverbot has been Refreshed```");
    }else{
      if(self.CleverManager.enabled){
        self.CleverManager.enabled = false;
        self.bot.sendMessage(parsedMsg.msg.channel, "```Cleverbot is no longer active```");
      }else {
        self.CleverManager.enabled = true;
        self.bot.sendMessage(self.CleverManager.channelid, parsedMsg.params[0]);

      }
    }
  }
  cleverMessage(msg){
    var self = this;
    if(!self.CleverManager){
      return;
    }

    if(msg.author.name == self.bot.user.username){
      if(self.CleverManager.enabled && msg.channel.id == self.CleverManager.channelid){
        setTimeout(function f(){
          self.CleverManager.sendMsg(msg.content,function cb(reply){
            self.bot.sendMessage(msg.channel, reply);
          });
        }, 1500);
      }
    }
  }
  cmdTest(parsedMsg){
    var self = this;

    self.bot.sendMessage(parsedMsg.msg.channel, "Test Command: " + parsedMsg.params);
  }
  cmdHelp(parsedMsg){
    var self = this;

    var SendString = "``` === HELP === \n";
    for (var i = 0; i < self.CommandHandler.list.length; i++) {
  		var cmd = self.CommandHandler.list[i];
  		//cmd.cmd, cmd.desc,cmd.usage
      SendString = SendString + "-"+self.CommandHandler.prefix+cmd.cmd+" : "+cmd.desc+" - " + self.CommandHandler.prefix+ cmd.usage + "\n";
  		SendString = SendString + "\n";
  	}
  	SendString = SendString + "```";
  	self.bot.sendMessage(parsedMsg.msg.channel, SendString);
  }
  cmdPlay(parsedMsg){
    var self = this;
    if(!self.audioPlayer){
      self.bot.sendMessage(parsedMsg.msg.channel, "``` Audio Player not Enabled! ```");
      return;
    }
    if(!self.VoiceManager){
      self.bot.sendMessage(parsedMsg.msg.channel, "``` VoiceManager not Enabled! (VoiceManager is required for AudioPlayer) ```");
      return;
    }

    var fileName = parsedMsg.params[0];
    self.bot.sendMessage(parsedMsg.msg.channel, "``` Attempting to Play File: " + fileName + ".mp3 ```");
    self.audioPlayer.playFile(fileName, parsedMsg, parsedMsg.params, self.audioPlayer.defaultVolume, self.audioPlayer.maxVolume,function(text){
      if(text === "loud"){
        self.bot.sendMessage(parsedMsg.msg.channel, "``` Volume over threshold of " + self.audioPlayer.maxVolume + "! Remains default (" + self.audioPlayer.defaultVolume +") ```");
      }
      if(text === "notfound"){
        self.bot.sendMessage(parsedMsg.msg.channel, "``` You must be inside a channel that the bot is in to request a File ```");
      }
    });
  }
  cmdStop(parsedMsg){
    var self = this;
    if(!self.audioPlayer){
      self.bot.sendMessage(parsedMsg.msg.channel, "``` Audio Player not Enabled! ```");
      return;
    }
    if(!self.VoiceManager){
      self.bot.sendMessage(parsedMsg.msg.channel, "``` VoiceManager not Enabled! (VoiceManager is required for AudioPlayer) ```");
      return;
    }

    self.bot.sendMessage(parsedMsg.msg.channel, "``` Playback stopped! ```");
    self.audioPlayer.stopPlaying(parsedMsg, function cb(text){
      if(text === "notfound"){
        self.bot.sendMessage(parsedMsg.msg.channel, "``` You must be inside a channel that the bot is in to request a File ```");
      }
    });
  }
  cmdJoinVoice(parsedMsg){
    var self = this;
  	if(parsedMsg.msg.author.voiceChannel){
  		var id = parsedMsg.msg.author.voiceChannel;
  		self.VoiceManager.JoinChannelWithId(id);
  		self.bot.sendMessage(parsedMsg.msg.channel, "``` Joined the channel you are in! ```");
  	}else {
  		self.bot.sendMessage(parsedMsg.msg.channel, "``` You are not in a voice Channel ```");
  	}

  }
  cmdLeaveVoice(parsedMsg){
    var self = this;
    if (parsedMsg.msg.author.voiceChannel){
  		var id = parsedMsg.msg.author.voiceChannel;
      self.VoiceManager.LeaveChannel(id);
      self.bot.sendMessage(parsedMsg.msg.channel, "``` Left the channel you are in! ```");
    }else {
  		self.bot.sendMessage(parsedMsg.msg.channel, "``` You are not in a voice Channel ```");
  	}
  }

  cmdFollow(parsedMsg){
    var self = this;
    if(self.VoiceManager){
      if(self.VoiceManager.voiceEvents){
        self.VoiceManager.Follow(parsedMsg.msg.author);
        console.log("[VoiceManager - CmdFollow ] Following: " + parsedMsg.msg.author.username);
        self.bot.sendMessage(parsedMsg.msg.channel, "```Following: " + parsedMsg.msg.author.username+"```")
      }else{
        console.log("[VoiceManager - CmdFollow ] Voice events no enabled!");
      }
    }else{
      console.log("[VoiceManager - CmdFollow ] No Manager set!");
    }
  }

  cmdUnfollow(parsedMsg){
    var self = this;
    if(self.VoiceManager){
      if(self.VoiceManager.voiceEvents){
        self.VoiceManager.Follow(parsedMsg.msg.author);
        console.log("[VoiceManager - cmdUnfollow ] Unfollow: " + parsedMsg.msg.author.username);
        self.bot.sendMessage(parsedMsg.msg.channel, "```Unfollow: " + parsedMsg.msg.author.username+"```")
      }else{
        console.log("[VoiceManager - cmdUnfollow ] Voice events no enabled!");
      }
    }else{
      console.log("[VoiceManager - cmdUnfollow ] No Manager set!");
    }
  }
  cmdListAudio(parsedMsg){
    var self = this;
    var Page = 1;
    if(parsedMsg.params[0]){
      Page = parseInt(parsedMsg.params[0]);
    }


    var ResultsPerPage = 15;
    var Start = (Page * ResultsPerPage) - ResultsPerPage;
    var CurrentIndex = 0;

    var SendString = "``` === AUDIO CLIPS (Page: "+Page+")=== \n";
    self.audioPlayer.listAll("./Audio/", function(name){
      CurrentIndex++;
      if(CurrentIndex >= Start)
      {
        if(CurrentIndex < Start + ResultsPerPage)
        {
          SendString = SendString + "-"+name+ "\n";
        }
      }

    }, function(){
      SendString = SendString + "```";
      self.bot.sendMessage(parsedMsg.msg.channel, SendString);
    });

  }

  cmdTestConfig(parsedMsg){
    var self = this;
    self.bot.sendMessage(parsedMsg.msg.channel, "Test Worked!");
  }



}
module.exports = Disnode;