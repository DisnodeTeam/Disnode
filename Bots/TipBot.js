var DiscordBot = require("../DisnodeLib/DiscordBot.js");
var bot = new DiscordBot("MTg2NjAzMDIxODEwMDA4MDY0.Ci1B4g.PbBkhtZM6yreIFNfKKGaEU3tolY");

bot.on("Bot_Ready", function(){
    console.log('[TB - BotReady] Bot Ready.');
    bot.enableAudioPlayer({path: './Audio/'});

    var cmdList = [
      {cmd:"helloworld",run: test,desc: "Hello World Command",usage:"!"+"helloworld"},
      {cmd: "help",run: test,desc: "List All Commands",usage:"!"+"help"},
    ];

    bot.enableCommandHandler({prefix: "$",list:cmdList});
    bot.addDefaultCommands();

    bot.enableVoiceManager({voiceEvents:true});

        bot.enableBotCommunication({});
          bot.enableCleverManager({});
});

bot.on("Bot_Init", function () {
  console.log("[TB - BotReady] Bot Init.");


});



bot.on("Bot_RawMessage", function(msg){
  console.log("[TB - BotReady] Recieved Raw msg: " + msg.content);
});

exports.Start = function () {
  bot.startBot();

};
var test = function(msg)
{
  bot.bot.sendMessage(msg.msg.channel, "TEST!!!!!!");
}