const Genyo = require('./index');
require('dotenv').config();

(async() => {
    const acc = new Genyo(process.env.USERID, process.env.PASSWORD);
    await acc.authenticate()
    
    // Get homepage (Not really necessary method, just used when errors happen)
    // let home = await acc.getHomepage()
    // console.log(home.current)
    // console.log(acc)

    // Get current tasks (page 1)
    // let ctasks = await acc.getCurrentTasks()
    // console.log(ctasks)

    // Get completed tasks (page 1)
    // let comptasks = await acc.getCompletedTasks()
    // console.log(comptasks)

    // Get expired tasks (page 1)
    // let etasks = await acc.getExpiredTasks()
    // console.log(etasks)
    
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

    // Get unread announcements:
    // let unread = await acc.getUnreadAnnouncements()
    // console.log(unread)

    // Get read announcements
    let read = await acc.getReadAnnouncements()
    console.log(read)
})()
