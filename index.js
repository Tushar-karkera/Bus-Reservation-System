const express = require('express')
const app = express();
const bcrpyt = require('bcrypt')
const path = require('path')
const mysql = require('mysql')
const bodyParser = require('body-parser');
const { json } = require('express/lib/response');
const { exit } = require('process');
const port = 3000;


app.set('view engine', 'ejs');

//database connection attributes
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'dbms_new'
})

app.use(express.urlencoded({
    extended: true
}))


//including the static pages
app.use(express.static(path.join(__dirname, 'static')))

//homepage
app.get('/', (req, res) => {
    res.render(path.join(__dirname, './static/html/login'), { alert: 'null' })
});



//app listening on a port 
app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`)
});

//create user page
app.get('/create', (req, res) => {
    res.render(path.join(__dirname, './static/html/create'))

})

//create user request
app.post('/createuser', async (req, res) => {
    let names = req.body["name"]
    let passw = req.body["password"]
    let email = req.body["email"]
    let phno = parseInt(req.body["phno"])
    let location = req.body["location"]
    let hashedpass = ""
    cust_id = Math.floor((Math.random() * 100000) + 1);

    try {
        const salt = await bcrpyt.genSalt()
        hashedpass = await bcrpyt.hash(passw, salt)
    }
    catch {
        console.log("salt generation error")
    }

    pool.getConnection((err, connection) => {
        if (err) throw err
        connection.query(`insert into customer values("${cust_id}","${names}","${hashedpass}","${email}","${phno}","${location}")`, (err1, rows) => {
            //connection.release() // return the connection to pool
            if (err1) {
                console.log(err1)
                res.render(path.join(__dirname, './static/html/errorpage'))
            } else {
                res.redirect('/')
            }


        })
    })
})

//login admin after inputting the credentials
app.post('/admin', async (req, res) => {
    let names = req.body.name
    let passw = req.body.password
    let hashedpass = ""

    try {
        const salt = await bcrpyt.genSalt()
        hashedpass = await bcrpyt.hash(passw, salt)
    }
    catch {
        console.log("salt generation error")
    }

    pool.getConnection((err, connection) => {
        if (err) console.log(err)
        connection.query(`SELECT admin_password from admin where admin_name ="${names}"`, async (err1, rows) => {
            if (Object.keys(rows).length <= 0) {
                // console.log("err")
                connection.release() // return the connection to pool
                res.render(path.join(__dirname, './static/html/login'), { alert: 'authentication error' })
            }

            else if (await bcrpyt.compare(passw, rows[0]["admin_password"])) {
                var objs = []
                connection.query(`select * from customer`, (err3, rs1) => {
                    if (err3) {
                        res.render(path.join(__dirname, './static/html/login'), { alert: 'authentication error' })
                    }
                    else {
                        connection.query(`select * from destination`, (err4, rs2) => {
                            if (err4) {
                                res.render(path.join(__dirname, './static/html/errorpage'))
                            }
                            else {

                                var r3 = rs1.concat(rs2)    
                                connection.query(`SELECT b.bus_name,b.bus_id,b.bus_capacity,b.current_capacity ,
                                d.destination_set_name as "destination_name" , d2.destination_set_name as "source_name"
                                from bus b , destination d , destination d2
                                where b.destination_id = d.destination_id
                                and b.bus_source = d2.destination_id`, (err5, rs3) => {
                                    if (err5) {
                                        res.render(path.join(__dirname, './static/html/errorpage'))
                                    }
                                    else {
                                        res.render(path.join(__dirname, './static/html/adminpage'), { record: r3, bus: rs3 , alert: true })

                                    }
                                })
                                //res.render(path.join(__dirname, './static/html/adminpage'), { record: r3, alert: true })

                            }
                        })


                    }
                })


            } else {
                res.render(path.join(__dirname, './static/html/login'), { alert: 'authentication error' })
            }

        })
    })
});


//login customer
app.post('/customer', async (req, res) => {
    let names = req.body.name
    let passw = req.body.password
    pool.getConnection((err, connection) => {
        if (err) console.log(err)
        connection.query(`SELECT customer_password from customer where customer_name ="${names}"`, async (err2, rows) => {
            if (Object.keys(rows).length <= 0) {
                console.log("err")
                res.render(path.join(__dirname, './static/html/login'), { alert: 'authentication error' })
                connection.release() //releases connection to pool
            }
            else if (await bcrpyt.compare(passw, rows[0]["customer_password"])) {

                customer_display(names, res, passw)

            } else {
                res.render(path.join(__dirname, './static/html/login'), { alert: 'authentication error' })
            }

        })
    })
});

app.post('/addbus', async (req, res) => {
    busname = req.body["name"]
    source = req.body["source"]
    dest = req.body["destination"]
    id = req.body["bus_id"]
    capacity = req.body["capacity"]
    pool.getConnection((err, connection) => {
        if (err) {
            res.render(path.join(__dirname, './static/html/errorpage'))
        }
        connection.query(`insert into bus values("${busname}","${id}","${capacity}",
        (SELECT destination_id from destination WHERE destination_set_name = "${source}"),"${capacity}","123",
        (SELECT destination_id from destination WHERE destination_set_name = "${dest}"))`, async (err2, rows) => {
            if (err2) {
                console.log(err2)
                res.send("error during insertion of bus !!!!")
            }
            else {
                database_admin(res)
            }
        })
    })

})


app.post('/deletebus', async (req, res) => {
    busname = req.body["name"]
    id = req.body["bus_id"]
    pool.getConnection((err, connection) => {
        if (err) console.log(err)
        connection.query(`delete from bus where bus_name='${busname}' and bus_id=${id}`, async (err1, rows) => {

            if (err1) {
                res.send("error during deletion of bus !!!!")
            }
            else {
                database_admin(res)
            }
        })
    })

})

app.post('/book', async (req, res) => {

    dest = req.body["dest"]
    // checkin = req.body["date"]
    no_of_seats = req.body["seats"]
    username = req.body["username"]
    bus_name = req.body["bus_name"]
    passws = req.body["Passwords"]



    pool.getConnection((err, connection) => {
        if (err) {
            res.render(path.join(__dirname, './static/html/errorpage'))
            connection.release()
        }
        else {
            connection.query(`select bus_capacity from bus b , destination d
            where b.destination_id = d.destination_id
            and b.bus_name="${bus_name}" and destination_set_name="${dest}"`, (err1, rs1) => {
                if (err1 | Object.keys(rs1).length <= 0) {
                    res.send("wrong details please check again")
                }
                else if (parseInt(rs1[0]["bus_capacity"]) - parseInt(no_of_seats) > 0) {
                    seats = parseInt(no_of_seats)
                    // console.log(seats)
                    connection.query(`update bus set current_capacity=current_capacity-${seats} where bus_name='${bus_name}'`, (err2, rs2) => {
                        if (err2) {
                            res.render(path.join(__dirname, './static/html/errorpage'))
                        }
                        else {
                            // console.log("pass")
                            ticketbook(res, username, bus_name, dest, passws, no_of_seats)
                        }
                    })
                }
                else {
                    res.send("wrong details please check again")
                }
            })

        }
    })


})


function database_admin(res) {
    pool.getConnection((err, connection) => {
        var objs = []
        connection.query(`select * from customer`, (err, rs1) => {
            if (err) {
                res.render(path.join(__dirname, './static/html/errorpage'))
                // console.log(err)
            }
            else {
                connection.query(`select * from destination`, (err2, rs2) => {
                    if (err2) {
                        res.render(path.join(__dirname, './static/html/errorpage'))
                    }
                    else {

                        var r3 = rs1.concat(rs2)    
                        connection.query(`SELECT b.bus_name,b.bus_id,b.bus_capacity,b.current_capacity ,
                        d.destination_set_name as "destination_name" , d2.destination_set_name as "source_name"
                        from bus b , destination d , destination d2
                        where b.destination_id = d.destination_id
                        and b.bus_source = d2.destination_id`, (err3, rs3) => {
                            if (err3) {
                                res.render(path.join(__dirname, './static/html/errorpage'))
                            }
                            else {
                                res.render(path.join(__dirname, './static/html/adminpage'), { record: r3, bus: rs3 , alert: true })

                            }
                        })
                        //res.render(path.join(__dirname, './static/html/adminpage'), { record: r3, alert: true })

                    }
                })


            }
        })
    })
}

function database_customer(res) {
    pool.getConnection((err, connection) => {
        connection.query(`select * from bus`, (err, rs) => {
            res.render(path.join(__dirname, './static/html/userpage'), { record: rs, username: names })
        })
    })
}

//ticket id generator
const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

//ticket booking
function ticketbook(res, customer_name, bus_name, dest, passws, no_of_seats) {
    pool.getConnection((err, connection) => {
        var bus_id = 0
        var cust_id = ""
        var dest_id = ""
        console.log(customer_name, bus_name, dest)
        ticket_id = genRanHex(9);
        connection.query(`select bus_id from bus where bus_name = '${bus_name}'`, (err1, rs1) => {
            if (err1) {
                res.render(path.join(__dirname, './static/html/errorpage'))
            }
            else {
                bus_id = parseInt(rs1[0]["bus_id"])
                connection.query(`select customer_id from customer where customer_name = '${customer_name}'`, (err2, rs2) => {
                    if (err2) {
                        res.render(path.join(__dirname, './static/html/errorpage'))
                    }
                    else {
                        cust_id = parseInt(rs2[0]["customer_id"])
                        connection.query(`select destination_id from destination where destination_set_name = '${dest}' `, (err3, rs3) => {
                            if (err3) {
                                res.render(path.join(__dirname, './static/html/errorpage'))
                            }
                            else {

                                dest_id = parseInt(rs3[0]["destination_id"])
                                no_of_seats = parseInt(no_of_seats)
                                connection.query(`insert into ticket values("${ticket_id}",${no_of_seats}*500,${no_of_seats},${cust_id},${bus_id})`, (err4, rs4) => {
                                    if (err4) {
                                        console.log(err4)
                                        res.render(path.join(__dirname, './static/html/errorpage'))
                                    }
                                    else {
                                        // console.log("inserted !!!!")
                                        res.render(path.join(__dirname, './static/html/checkout'), { name: customer_name, cost: no_of_seats * 500, passwords: passws, ticket_id: ticket_id })
                                    }
                                })
                            }
                        })
                    }

                })
            }
        })




    })
}

function customer_display(names, res, passw) {
    pool.getConnection((err1, connection) => {
        if (err1) {
            console.log('error')
        }
        connection.query(`select t.ticket_id , d.destination_set_name , t.price , b.bus_name as booked_bus_name 
        from ticket t , destination d , bus b where t.customer_id = (select c.customer_id from customer c where c.customer_name='${names}')
        and b.bus_id = t.bus_id
        and b.destination_id = d.destination_id`, (err2, res1) => {
            if (err2) {
                res.render(path.join(__dirname, './static/html/userpage'), { record: res1, username: names, alert: 'error' })
            }
            else {
                connection.query(`SELECT b.bus_name,b.bus_id,b.bus_capacity,b.current_capacity ,
                d.destination_set_name as "destination_name" , d2.destination_set_name as "source_name"
                from bus b , destination d , destination d2
                where b.destination_id = d.destination_id
                and b.bus_source = d2.destination_id`, (err2, res2) => {
                    if (err2) {
                        res.render(path.join(__dirname, './static/html/errorpage'))
                    }
                    var r4 = res1.concat(res2)
                    // console.log(res1,names)
                    res.render(path.join(__dirname, './static/html/userpage'), { record: r4, username: names, passwords: passw, alert: 'null' })
                })
            }

        })

    })
}
app.post('/delete_ticket', async (req, res) => {
    ticket_no = req.body['ticket_id']
    username = req.body["username"]
    passw = req.body["Passwords"]
    console.log("username : " + username)
    console.log("password : " + passw)
    pool.getConnection((err1, connection) => {
        if (err1) {
            res.send("error while deletion")
        }
        else {
            connection.query(`UPDATE bus set current_capacity = (current_capacity +(SELECT no_of_seats from ticket where ticket_id = '${ticket_no}')) WHERE bus_id in
            (select t.bus_id from ticket t where ticket_id = '${ticket_no}')`, (err2, rs1) => {
                if (err2) {
                    console.log(err2)
                    res.render(path.join(__dirname, './static/html/errorpage'))
                }
                else {
                    // customer_display(username,res,passw)
                    connection.query(`delete from ticket where ticket_id='${ticket_no}'`, (err3, rs1) => {
                        if (err3) {
                            console.log(err3)
                            res.render(path.join(__dirname, './static/html/errorpage'))
                        }
                        else {
                            customer_display(username, res, passw)
                        }
                    })
                }
            })
        }
    })
})