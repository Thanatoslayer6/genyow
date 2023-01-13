const axios = require('axios')
const cheerio = require('cheerio')
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar()
require('dotenv').config()

class Genyo {
    // For cheerio loading and such
    #$; 
    // Private variables for username and password
    #userid; 
    #password; 
    #epuid; // Needed payload for getting announcements

    constructor(userid, password) {
        this.currentTasksCount = null;
        this.completedTasksCount = null;
        this.expiredTasksCount = null;
        this.upcomingTasksCount = null;
        this.favoriteTasksCount = null;

        // Get possible number of pages for current tasks, completed tasks, and such
        this.client = wrapper(axios.create({
            baseURL: "https://idiwa.com.ph",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0",
            },
            jar // cookie jar will grab all cookies for every request,
        }))
        // Check credentials
        if (!userid || !password) {
            throw new Error("Missing/Wrong credentials!")
        }
        this.#userid = userid
        this.#password = password
    }

    // Starting method to initialize and login (should be called after instantiation)
    async authenticate() {
        // 1st request [GET]
        let info = await this.client.get("/Genyolm009/login.aspx")
        // Scrape to get viewstate from login page (very essential cookie)
        this.#$ = cheerio.load(info.data)
        let viewState = this.#$('#__VIEWSTATE').attr('value').toString() 
        let viewStateGenerator = this.#$('#__VIEWSTATEGENERATOR').attr('value').toString()
        // 2nd request [POST]
        const loginResponse = await this.client.post(
            '/Genyolm009/login.aspx',
            new URLSearchParams({
                '__EVENTTARGET': 'btnLogin',
                '__EVENTARGUMENT': '', // Seems to be nothing for now
                '__VIEWSTATE': viewState, // The viewstate scraped from /Genyolm009/login.aspx
                '__VIEWSTATEGENERATOR': viewStateGenerator, // just gonna replace this as well if it changes or something
                '__VIEWSTATEENCRYPTED': '', // Seems to be nothing for now 
                'txtUserID': this.#userid, // Genyo userid
                'txtPassword': this.#password, // Genyo password
                // Everything below is just default
                'hidPortalType': 'school',
                'hidIsFacebookLogin': 'false',
                'hidGoogleClientId': '',
                'hidGoogleSsoRedirectUri': '',
                'hidStudentSupportDoc': '/edulearnnetupload/help/doc/LMS_Students_UserGuide.pdf',
                'hidTeacherSupportDoc': '/edulearnnetupload/help/doc/LMS_Teachers_UserGuide.pdf',
                'hidParentSupportDoc': '/edulearnnetupload/help/doc/LMS_ParentsPortal_UserGuide.pdf',
                'hidBackgroundImgURL': '',
                'userid': '',
                'password': ''
            })
        );
        if (loginResponse.status != 200) {
            throw new Error(`Failed to authenticate! - STATUS ${loginResponse.status}`)
        }
        this.#$ = cheerio.load(loginResponse.data)
        console.log(`Successfully logged in as: ${this.#$('#spUserName').text()}`)
    }

    // Scrapes total tasks count of 'completed', 'expired', 'upcoming', 'favorite' from html and epuid
    #scrapeBasicInfo() {
        if (!this.currentTasksCount) {
            this.currentTasksCount = Number(this.#$('#ctl00_MainContent_lkbtncurrent h3').text())
        }
        if (!this.completedTasksCount) {
            this.completedTasksCount = Number(this.#$('#ctl00_MainContent_lkbtnCompleted h3').text())
        }
        // !this.completedTasksCount ? Number(this.#$('#ctl00_MainContent_lkbtnCompleted h3').text()) : null
        if (!this.expiredTasksCount) {
            this.expiredTasksCount = Number(this.#$('#ctl00_MainContent_lkbtnExpired h3').text())
        }
        if (!this.upcomingTasksCount) {
            this.upcomingTasksCount = Number(this.#$('#ctl00_MainContent_lkbtnUpcomming h3').text())
        }
        if (!this.favoriteTasksCount) {
            this.favoriteTasksCount = Number(this.#$('#ctl00_MainContent_lkbtnFavorites h3').text())
        }
        if (!this.reportBookCount) {
            this.reportBookCount = Number(this.#$('.spanReportBookCount').text()?.slice(1, -1)) || 0
        }
        if (!this.announcementsCount) {
            this.announcementsCount = Number(this.#$('.spanMsgCount').text()?.slice(1, -1)) || 0
        }
        if (!this.messagesCount) {
            this.messagesCount = Number(this.#$('.spanEdupostCount').text()?.slice(1, -1)) || 0
        }
        if (!this.#epuid) {
            this.#epuid = this.#$('.hidEPuid').text()
        }
    }
    
    // Private method used when getting all of tasks for a certain endpoint
    async #concurrentRequests(endpoint, maxPage) {
        let requests = []
        for (let i = 1; i <= maxPage; i++) { 
            requests.push(
                this.client.post(endpoint,
                new URLSearchParams({
                    '__EVENTTARGET': 'ctl00$MainContent$pager2',
                    '__EVENTARGUMENT': i,
                }))
            )
        }
        return await Promise.all(requests) // Return the results -> '?.data' for html
    }

    async getHomepage() {
        // Endpoint is the same as current tasks
        let homepageResponse = await this.client.get("/Genyolm009/Task/TK_NTasksGrid.aspx")
        if (homepageResponse.status != 200) {
            throw new Error(`Failed to request homepage! - STATUS ${homepageResponse.status}`)
        }
            // this.homepageHTMLResponse = homepageResponse.data 
        this.#$ = cheerio.load(homepageResponse.data)
        // Assign the count of completed tasks, expired tasks, upcoming tasks, and such
        this.#scrapeBasicInfo()
        // Return json data with the following information
        return {
            current: {
                count: Number(this.#$('#ctl00_MainContent_lkbtncurrent h3').text()),
                list:  this.#$('div.card-body.p-2').map((_, el) => {
                    return {
                        type: (this.#$(el).find('a.text-muted').text()).trim(),
                        title: this.#$(el).find('div.col-10 h5 a').text(),
                        link: (this.#$(el).find('div.col-10 h5 a').attr('href')).replace(/\n/g, ''),
                        expiry: this.#$(el).find('li.medium a.creator-username').first().text(),
                        from: {
                            teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                            href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                        } 
                    }
                }).get()
            },
            completed: {
                count: this.completedTasksCount
            },
            expired: {
                count: this.expiredTasksCount
            },
            upcoming: {
                count: this.upcomingTasksCount
            },
            favorites: {
                count: this.favoriteTasksCount
            },
            // Upper navigation bar -> Report Book, Announcements, Messages
            reportBook: { 
                count: this.reportBookCount
            },
            announcements: {
                count: this.announcementsCount
            },
            messages: {
                count: this.messagesCount
            },
        }
    }

    /* function - getCurrentTasks(pagenum: number = 1)
     * pagenum: number - the specified page number for the current tasks (automatically grabs 1st page)
     * if no parameter is specified defaults to pagenum=1
     */
    async getCurrentTasks(pagenum = 1) {
        // Scrape the first page for completed tasks if 'this.completedTasksCount' is null || undefined
        // This is done in order to get the maximum # of pages
        if (!this.currentTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo() // This will get 'this.completedTasksCount'
        }
        
        // Checks if pagenum is not within range
        // If for instance, the completed tasks are less than 10 most likely when 4 or below, then just make 'Math.round(this.completedTasksCount)' equal to 1
        if (!(pagenum >= 1 && pagenum <= Math.round(this.currentTasksCount/10) || 1)) { //[1, maxPage]
            throw new Error(`Page number is not within range! - Range is between [1, ${Math.round(this.currentTasksCount/10)}]`)
        } 
        if (pagenum != 1) {
            let currentTasksResponse = await this.client.post('/Genyolm009/Task/TK_NTasksGrid.aspx',
                new URLSearchParams({
                    '__EVENTTARGET': 'ctl00$MainContent$pager2',
                    '__EVENTARGUMENT': pagenum,
                })
            )
            if (currentTasksResponse.status != 200) {
                throw new Error(`Failed to request completed tasks! - STATUS ${currentTasksResponse.status}`)
            }
            this.#$ = cheerio.load(currentTasksResponse.data) 
        }
        return {
            page: pagenum,
            list: this.#$('div.card-body.p-2').map((_, el) => {
                return {
                    type: (this.#$(el).find('p.text-muted span').text()).trim(),
                    subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                    title: this.#$(el).find('b.tasktakelinkblock a').text().replace(/\n/g, ''), // Get rid of new lines
                    link: (this.#$(el).find('b.tasktakelinkblock a').attr('href')).replace(/\n/g, ''),
                    // completedAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                    from: {
                        teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                        href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                    } 
                }
            }).get(),
            // Max number of pages, say for instance 201 tasks, this means 201/10 = 20.1, round it up then you 20 pages
            numOfPages: Math.round(this.currentTasksResponse/10) || 1
        }
    }

    async getAllCurrentTasks() {
        let result = [], requests = []

        if (!this.currentTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo() 
        }
        let responses = await this.#concurrentRequests('/Genyolm009/Task/TK_NTasksGrid.aspx', (Math.round(this.currentTasksCount/10) || 1))
        result = responses.map(items => {
            this.#$ = cheerio.load(items.data)
            return {
                page: Number((this.#$('.PagerCurrentPageCell strong').text()).trim()) || 1, // Scrape page num 
                list: this.#$('div.card-body.p-2').map((_, el) => {
                    return {
                        type: (this.#$(el).find('p.text-muted span').text()).trim(),
                        subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                        title: this.#$(el).find('b.tasktakelinkblock a').text().replace(/\n/g, ''), // Get rid of new lines
                        link: (this.#$(el).find('b.tasktakelinkblock a').attr('href')).replace(/\n/g, ''),
                        // completedAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                        from: {
                            teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                            href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                        } 
                    }
                }).get(),
            }
        })
        return result
    }
    /* function - getCompletedTasks(pagenum: number = 1)
     * pagenum: number - the specified page number for the completed tasks (automatically grabs 1st page)
     * if no parameter is specified defaults to pagenum=1
     */
    async getCompletedTasks(pagenum = 1) {
        // Scrape the first page for completed tasks if 'this.completedTasksCount' is null || undefined
        // This is done in order to get the maximum # of pages
        if (!this.completedTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksHistoryGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo() // This will get 'this.completedTasksCount'
        }
        
        // Checks if pagenum is not within range
        // If for instance, the completed tasks are less than 10 most likely when 4 or below, then just make 'Math.round(this.completedTasksCount)' equal to 1
        if (!(pagenum >= 1 && pagenum <= Math.round(this.completedTasksCount/10) || 1)) { //[1, maxPage]
            throw new Error(`Page number is not within range! - Range is between [1, ${Math.round(this.completedTasksCount/10)}]`)
        } 
        if (pagenum != 1) {
            let completedTasksResponse = await this.client.post('/Genyolm009/Task/TK_NTasksHistoryGrid.aspx',
                new URLSearchParams({
                    '__EVENTTARGET': 'ctl00$MainContent$pager2',
                    '__EVENTARGUMENT': pagenum,
                })
            )
            if (completedTasksResponse.status != 200) {
                throw new Error(`Failed to request completed tasks! - STATUS ${completedTasksResponse.status}`)
            }
            this.#$ = cheerio.load(completedTasksResponse.data) 
        }
        return {
            page: pagenum,
            list: this.#$('div.card-body.p-2').map((_, el) => {
                return {
                    type: (this.#$(el).find('p.text-muted span').text()).trim(),
                    subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                    title: this.#$(el).find('b.tasktakelinkblock a').text().replace(/\n/g, ''), // Get rid of new lines
                    link: (this.#$(el).find('b.tasktakelinkblock a').attr('href')).replace(/\n/g, ''),
                    completedAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                    from: {
                        teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                        href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                    } 
                }
            }).get(),
            // Max number of pages, say for instance 201 tasks, this means 201/10 = 20.1, round it up then you 20 pages
            numOfPages: Math.round(this.completedTasksCount/10) || 1
        }
    }
     
    async getAllCompletedTasks() {
        let result = [], requests = []

        if (!this.completedTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksHistoryGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo() 
        }
        let responses = await this.#concurrentRequests('/Genyolm009/Task/TK_NTasksHistoryGrid.aspx', (Math.round(this.completedTasksCount/10) || 1))
        result = responses.map(items => {
            this.#$ = cheerio.load(items.data)
            return {
                page: Number((this.#$('.PagerCurrentPageCell strong').text()).trim()) || 1, // Scrape page num 
                list: this.#$('div.card-body.p-2').map((_, el) => {
                    return {
                        type: (this.#$(el).find('p.text-muted span').text()).trim(),
                        subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                        title: this.#$(el).find('b.tasktakelinkblock a').text().replace(/\n/g, ''), // Get rid of new lines
                        link: (this.#$(el).find('b.tasktakelinkblock a').attr('href')).replace(/\n/g, ''),
                        completedAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                        from: {
                            teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                            href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                        } 
                    }
                }).get(),
            }
        })
        return result
    }
    
    /* function - getExpiredTasks(pagenum: number = 1)
     * pagenum: number - the specified page number for the expired tasks (automatically grabs 1st page)
     * if no parameter is specified defaults to pagenum=1
     */
    async getExpiredTasks(pagenum = 1) {
        // Scrape the first page for completed tasks if 'this.completedTasksCount' is null || undefined
        // This is done in order to get the maximum # of pages
        if (!this.expiredTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksExpiredGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo()
        }
        
        // Checks if pagenum is not within range
        if (!(pagenum >= 1 && pagenum <= Math.round(this.expiredTasksCount/10) || 1)) { //[1, maxPage]
            throw new Error(`Page number is not within range! - Range is between [1, ${Math.round(this.completedTasksCount/10)}]`)
        } 
        if (pagenum != 1) {
            let expiredTasksResponse = await this.client.post('/Genyolm009/Task/TK_NTasksExpiredGrid.aspx',
                new URLSearchParams({
                    '__EVENTTARGET': 'ctl00$MainContent$pager2',
                    '__EVENTARGUMENT': pagenum,
                })
            )
            if (expiredTasksResponse.status != 200) {
                throw new Error(`Failed to request expired tasks! - STATUS ${expiredTasksCount.status}`)
            }
            this.#$ = cheerio.load(expiredTasksResponse.data) 
        }
        return {
            page: pagenum,
            list: this.#$('div.card-body.p-2').map((_, el) => {
                return {
                    type: (this.#$(el).find('p.text-muted span').text()).trim(),
                    subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                    title: this.#$(el).find('b.tasktakelinkblock').text().replace(/\n/g, ''), // Get rid of new lines
                    expiryAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                    from: {
                        teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                        href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                    } 
                }
            }).get(),
            // Max number of pages, say for instance 201 tasks, this means 201/10 = 20.1, round it up then you 20 pages
            numOfPages: Math.round(this.expiredTasksCount/10) || 1
        }
    }

    async getAllExpiredTasks() {
        let result = [], requests = []

        if (!this.expiredTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksExpiredGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo()
        }
        let responses = await this.#concurrentRequests('/Genyolm009/Task/TK_NTasksExpiredGrid.aspx', (Math.round(this.expiredTasksCount/10) || 1))
        result = responses.map(items => {
            this.#$ = cheerio.load(items.data)
            return {
                page: Number((this.#$('.PagerCurrentPageCell strong').text()).trim()) || 1, // Scrape page num 
                list: this.#$('div.card-body.p-2').map((_, el) => {
                    return {
                        type: (this.#$(el).find('p.text-muted span').text()).trim(),
                        subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                        title: this.#$(el).find('b.tasktakelinkblock').text().replace(/\n/g, ''), // Get rid of new lines
                        completedAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                        from: {
                            teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                            href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                        } 
                    }
                }).get(),
            }

        })
        return result
    }

    async getUpcomingTasks(pagenum = 1) {
        // Scrape the first page for completed tasks if 'this.completedTasksCount' is null || undefined
        // This is done in order to get the maximum # of pages
        if (!this.upcomingTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksFutureGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo()
        }
        // let maxPage = Math.round(this.upcomingTasksCount/10) 
        // Checks if pagenum is not within range
        if (!(pagenum >= 1 && pagenum <= Math.round(this.upcomingTasksCount/10) || 1)) { //[1, maxPage]
            throw new Error(`Page number is not within range! - Range is between [1, ${Math.round(this.upcomingTasksCount/10)}]`)
        } 
        if (pagenum != 1) {
            let upcomingTasksResponse = await this.client.post('/Genyolm009/Task/TK_NTasksFutureGrid.aspx',
                new URLSearchParams({
                    '__EVENTTARGET': 'ctl00$MainContent$pager2',
                    '__EVENTARGUMENT': pagenum,
                })
            )
            if (upcomingTasksResponse.status != 200) {
                throw new Error(`Failed to request upcoming tasks! - STATUS ${upcomingTasksResponse.status}`)
            }
            this.#$ = cheerio.load(upcomingTasksResponse.data) 
        }
        return {
            page: pagenum,
            list: this.#$('div.card-body.p-2').map((_, el) => {
                return {
                    type: (this.#$(el).find('p.text-muted span').text()).trim(),
                    subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                    title: this.#$(el).find('b.tasktakelinkblock').text().replace(/\n/g, ''), // Get rid of new lines
                    // link: (this.#$(el).find('b.tasktakelinkblock a').attr('href')).replace(/\n/g, ''),
                    expiryAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                    availableAt: this.#$(el).next().find('div.col-10 p').text(),
                    from: {
                        teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                        href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                    } 
                }
            }).get(),
            // Max number of pages, say for instance 201 tasks, this means 201/10 = 20.1, round it up then you 20 pages
            numOfPages: Math.round(this.upcomingTasksCount/10) || 1
        }
    }

    async getAllUpcomingTasks() {
        let result = [], requests = []

        if (!this.upcomingTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksFutureGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo()
        }
        let responses = await this.#concurrentRequests('/Genyolm009/Task/TK_NTasksFutureGrid.aspx', (Math.round(this.upcomingTasksCount/10) || 1))
        result = responses.map(items => {
            this.#$ = cheerio.load(items.data)
            return {
                page: Number((this.#$('.PagerCurrentPageCell strong').text()).trim()) || 1, // Scrape page num 
                list: this.#$('div.card-body.p-2').map((_, el) => {
                    return {
                        type: (this.#$(el).find('p.text-muted span').text()).trim(),
                        subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                        title: this.#$(el).find('b.tasktakelinkblock').text().replace(/\n/g, ''), // Get rid of new lines
                        expiryAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                        availableAt: this.#$(el).next().find('div.col-10 p').text(),
                        from: {
                            teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                            href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                        }
                    }
                }).get()
            }

        })
        return result
    }

    async getFavoriteTasks(pagenum = 1) {
        // Scrape the first page for completed tasks if 'this.completedTasksCount' is null || undefined
        // This is done in order to get the maximum # of pages
        if (!this.favoriteTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksFavGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo()
        }
        // let maxPage = Math.round(this.upcomingTasksCount/10) 
        // Checks if pagenum is not within range
        if (!(pagenum >= 1 && pagenum <= Math.round(this.favoriteTasksCount/10) || 1)) { //[1, maxPage]
            throw new Error(`Page number is not within range! - Range is between [1, ${Math.round(this.favoriteTasksCount/10)}]`)
        } 
        if (pagenum != 1) {
            let favoriteTasksResponse = await this.client.post('/Genyolm009/Task/TK_NTasksFavGrid.aspx',
                new URLSearchParams({
                    '__EVENTTARGET': 'ctl00$MainContent$pager2',
                    '__EVENTARGUMENT': pagenum,
                })
            )
            if (favoriteTasksResponse.status != 200) {
                throw new Error(`Failed to request favorite tasks! - STATUS ${favoriteTasksResponse.status}`)
            }
            this.#$ = cheerio.load(favoriteTasksResponse.data) 
        }
        return {
            page: pagenum,
            list: this.#$('div.card-body.p-2').map((_, el) => {
                return {
                    type: (this.#$(el).find('p.text-muted span').text()).trim(),
                    subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                    title: this.#$(el).find('b.tasktakelinkblock').text().replace(/\n/g, ''), // Get rid of new lines
                    link: (this.#$(el).find('b.tasktakelinkblock a').attr('href')).replace(/\n/g, ''),
                    expiryAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                    from: {
                        teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                        href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                    } 
                }
            }).get(),
            // Max number of pages, say for instance 201 tasks, this means 201/10 = 20.1, round it up then you 20 pages
            numOfPages: Math.round(this.favoriteTasksCount/10) || 1
        }
    }

    async getAllFavoriteTasks() {
        let result = [], requests = []

        if (!this.favoriteTasksCount) {
            let temp = await this.client.get('/Genyolm009/Task/TK_NTasksFavGrid.aspx')
            this.#$ = cheerio.load(temp.data)
            this.#scrapeBasicInfo()
        }

        let responses = await this.#concurrentRequests('/Genyolm009/Task/TK_NTasksFavGrid.aspx', (Math.round(this.favoriteTasksCount/10) || 1))
        result = responses.map(items => {
            this.#$ = cheerio.load(items.data)
            return {
                page: Number((this.#$('.PagerCurrentPageCell strong').text()).trim()) || 1, // Scrape page num 
                list: this.#$('div.card-body.p-2').map((_, el) => {
                    return {
                        type: (this.#$(el).find('p.text-muted span').text()).trim(),
                        subject: (this.#$(el).find('p.text-muted').contents().first().text()).trim().slice(0, -1),
                        title: this.#$(el).find('b.tasktakelinkblock').text().replace(/\n/g, ''), // Get rid of new lines
                        link: (this.#$(el).find('b.tasktakelinkblock a').attr('href')).replace(/\n/g, ''),
                        expiryAt: this.#$(el).find('li.medium a.creator-username').first().text().trim(),
                        from: {
                            teacher: this.#$(el).find('li.medium a.creator-username').last().text(),
                            href: this.#$(el).find('li.medium a.creator-username').last().attr('href')
                        } 
                    }
                }).get()
            }
        })
        return result
    }
        
    // TODO: Sending/Reading messages, announcements, profile pictures, "completed users"...
    async getAnnouncements() {
        if (!this.epuid) { // Just scrape directly from the announcements page
            let temp = await this.client.get('/Genyolm009/Message/MSG_NViewGrid.aspx')
            this.#$ = cheerio.load(temp.data)
        }
        // To be continued hehe
    }

    // Warning: EXPERIMENTAL!
    async AddToCompletedTask(moduleTypeId, moduleId) {
        let info = await this.client.post('/Genyolm009/Webservice/Task/TaskWebService.asmx/MT_Completed_Insert', {
            'details':`${moduleTypeId}||${moduleId}`
        })
        console.log(info.data)
    }
}

module.exports = Genyo
