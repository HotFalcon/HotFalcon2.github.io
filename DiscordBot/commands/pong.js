module.exports = {
    name: 'pong',
    description: "This is a ping command!",
    execute(message, args){
        message.channel.send('ping!');
    }
}