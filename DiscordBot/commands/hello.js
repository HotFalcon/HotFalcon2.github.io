module.exports = {
    name: 'hello',
    description: "This is a hello command!",
    execute(message, args){
        message.channel.send('Whats Up!');
    }
}