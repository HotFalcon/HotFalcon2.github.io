const Discord = require('discord.js');

const client = new Discord.Client();

const prefix = '-';

const fs = require('fs');

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for(const file of commandFiles){
    const command = require(`./commands/${file}`);


client.commands.set(command.name, command);
}

client.once('ready', () => {
console.log('I am online and ready!');
});

client.on('message', message =>{
if(!message.content.startsWith(prefix) || message.author.bot) return;

const args = message.content.slice(prefix.length).split(/ +/);
const command = args.shift().toLowerCase();

if(command === 'ping'){
    client.commands.get('ping').execute(message, args);
} else if (command == 'website'){
    client.commands.get('website').execute(message, args);
} else if (command == 'youtube'){
    client.commands.get('youtube').execute(message, args);
} else if (command == 'mods'){
    client.commands.get('mods').execute(message, args);
} else if (command == 'hello'){
    client.commands.get('hello').execute(message, args);
} else if (command == 'pong'){
    client.commands.get('pong').execute(message, args);
}
});


client.login(process.env.DISCORD_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE');