const express = require("express");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const nunjucks = require("nunjucks");
const db = require("./db")
var app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to check if the user is signed in
async function guard(req, res, next) {
    let session = await db.get_session(req.cookies.session)
    if (!session.signedIn) {
        res.redirect("/login")
        return
    }

    res.locals.session = session
    next()
}

// Middleware to check if the user has the required trust level
function trust_guard(level) {
    return (req, res, next) => {
        if (res.locals.session.TrustLevel < level) {
            res.redirect("/secure")
        } else {
            next()
        }
    }
}

// Serve static files
app.use(express.static("public"))
// Configure nunjucks
nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache : true
});

// Routes
app.get("/login", async (req, res) => {
    let session = await db.get_session(req.cookies.session)
    if (session.signedIn) {
        res.redirect("/secure")
        return
    }
    
    res.render("secure/login.html")
})

app.post("/login", async (req, res) => {
    let session = await db.login(req.body.username, req.body.password);
    
    if (!session.signedIn) {
        res.redirect("/login")
        return
    } else {
        res.cookie("session", session.SessionToken);
        res.redirect("/secure");

    }

})

app.all("/secure", guard, async (req,res)=>{
    res.render("secure/secure.html", {session: res.locals.session})
    
})

app.get("/secure/change_password", guard, async (req,res)=>{
    let error_message = req.cookies.error
    
    if (error_message) {
        res.render("secure/change_password.html", {session: res.locals.session, error: error_message});
    } else {
        res.render("secure/change_password.html", {session: res.locals.session, error: false});
    }
})

app.post("/secure/change_password", guard, async (req,res)=>{
    let error_message = await db.change_password(res.locals.session.EmployeeID, req.body.oldPassword, req.body.newPassword)
    if (error_message == null) {
        res.redirect("/secure")
    } else {
        res.cookie("error", error_message, {maxAge: 1000})
        res.redirect("/secure/change_password?error=true")
    }
})


// Management routes
app.get("/secure/manage/employees", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    let employees = await db.query("SELECT EmployeeID, Name, Salery, HireDate, TrustLevel, Username FROM employees WHERE Active = true;")

    res.render("secure/employee_management.html", {session: res.locals.session, employees: employees})
})

app.get("/secure/manage/employees/add", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    res.render("secure/add_employee.html", {session: res.locals.session})
})

app.post("/secure/manage/employees/add", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    let [isError, message] = await db.add_employee(req.body.username, req.body.password, req.body.name, req.body.salery, parseInt(req.body.trustLevel))
    res.render("secure/add_employee.html", {session: res.locals.session, posted: true, isError: isError, message: message})
})

app.get("/secure/manage/employees/disable/:id", guard, trust_guard(db.TrustLevel.Manager), async (req, res) => {
    // Prevent the user from disabling themselves
    if (res.locals.session.EmployeeID == req.params.id) {
        res.redirect("/secure/manage/employees/");
        return

    }
    // Disable the employee
    await db.blind_query("UPDATE employees SET Active = false WHERE EmployeeID = ?", [req.params.id])

    res.redirect("/secure/manage/employees/");

})

app.get("/secure/manage/items", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    let items = await db.query("SELECT * FROM items ORDER BY Hidden")

    res.render("secure/item_management.html", {session: res.locals.session, items: items})
});

app.get("/secure/manage/items/add", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    res.render("secure/add_item.html", {session: res.locals.session})
})

app.post("/secure/manage/items/add", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    await db.add_item(req.body.Name, req.body.Description, req.body.CostPrice, req.body.SellingPrice)
    res.redirect("/secure/manage/items")
})

app.get("/secure/manage/items/edit/:id", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{ 
    let item = await db.query("SELECT * FROM items WHERE ItemSku = ? ", [req.params.id])
    res.render("secure/add_item.html", {session: res.locals.session, item: item[0], editing: true})
})

app.post("/secure/manage/items/edit/:id", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    await db.update_item(req.params.id, req.body.Name, req.body.Description, req.body.CostPrice, req.body.SellingPrice)
    res.redirect("/secure/manage/items")
})

app.get("/secure/manage/items/hide/:id", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    await db.hide_item(req.params.id)
    res.redirect("/secure/manage/items")
})

app.get("/secure/manage/items/show/:id", guard, trust_guard(db.TrustLevel.Manager), async (req,res)=>{
    await db.show_item(req.params.id)
    res.redirect("/secure/manage/items")
})

app.get("/secure/record_sale", guard, async (req,res)=>{
    let items = await db.get_items()
    res.render("secure/record_sale.html", {session: res.locals.session, items: items})
})

// Record a sale
app.post("/secure/record_sale", guard, async (req,res)=>{
    let success = await db.record_sale(res.locals.session.EmployeeID, req.body.ItemSku, req.body.Quantity);
    let items = await db.get_items();
   
    res.render("secure/record_sale.html", {session: res.locals.session, post:true, success: success, items: items})
    
})

// Logout
app.get("/logout", guard, async (req,res)=>{
    await db.destroy_session(res.locals.session)

    res.redirect("/")
})

app.get("/", async (req,res)=>{
    let session = await db.get_session(req.cookies.session);
    let items = await db.get_items();

    res.render("index.html", {session: session, items: items})
})


// Start the server
app.listen(3000, ()=>{
    console.log("Listening on port 3000");
})

