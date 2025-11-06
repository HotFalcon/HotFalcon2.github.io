module.exports = {
    name: 'website',
    description: "This is a website command!",
    execute(message, args){
        message.channel.send('https://hotfalcon.net');
    }
}