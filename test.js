const Genyo = require('./index');
require('dotenv').config();

(async() => {
    const acc = new Genyo(process.env.USERID, process.env.PASSWORD);
    await acc.authenticate()
    
    // Get all current tasks
    let ctasks = await acc.getCurrentTasks()
    console.log(ctasks)

    // Get all completed tasks
    // let ctasks = await acc.getAllCompletedTasks()
    // console.log(ctasks)

    // Get all expired tasks
    // let etasks = await acc.getAllExpiredTasks()
    // console.log(etasks[0])

    // Get all upcoming tasks
    // let utasks = await acc.getAllUpcomingTasks()
    // console.log(utasks[0])

    // Get all favorite tasks
    // let etasks = await acc.getAllFavoriteTasks()
    // console.log(etasks[0])
})()
