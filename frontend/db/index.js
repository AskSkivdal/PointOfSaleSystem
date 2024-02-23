const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// Create a connection pool
const pool = mysql.createPool({
    connectionLimit: 5,
    host: 'mysql',
    user: "root",
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: "utf8mb4"
})

// Get the employees.
async function get_users() {
    return new Promise((acc, rej) => {
        pool.query('SELECT * FROM employees', 
        (err, rows) => {
            if (err) return rej(err);
            
            // Map the rows to objects 
            acc(rows.map(item =>
                Object.assign({}, item),
            ))
        })
    })
}

/**
 * 
 * 
 * @enum {TrustLevel}
 */
var TrustLevel = {
    Employee: 1,
    Manager: 2,
    Owner: 3,
    Admin: 4,
}

/**
 * 
 * @param {string} string 
 * @returns {TrustLevel}
 */
function string_to_TrustLevel(string) {
    switch (string) {
        case "Employee":
            return TrustLevel.Employee;
        case "Manager":
            return TrustLevel.Manager;
        case "Owner":
            return TrustLevel.Owner;
        case "Admin":
            return TrustLevel.Admin
    }
    return null
}

/**
 * 
 * @param {TrustLevel} level
 * @returns {string}
 */
function TrustLevel_to_string(level) {
    switch (level) {
        case TrustLevel.Employee:
            return "Employee";
        case TrustLevel.Manager:
            return "Manager";
        case TrustLevel.Owner:
            return "Owner";
        case TrustLevel.Admin:
            return "Admin"
    }
    return null
}



/**
 * @typedef {Object} Session
 * @property {bool} signedIn - Login status.
 * @property {number} EmployeeID - The employye id
 * @property {string} SessionToken - The session token.
 * @property {Date} ExpieryTime - The time the session expires.
 * @property {string} Username - The username.
 * @property {string} Name - The first and last name.
 * @property {TrustLevel} TrustLevel - The trust level.
 */

/**
 * 
 * @param {string} session_token 
 * @returns {Promise<Session>}
 */
async function get_session(session_token) {
    return new Promise(async (acc, rej) => {
        pool.query('SELECT s.EmployeeID, s.SessionToken, s.ExpieryTime, e.Username, e.Name, e.TrustLevel FROM sessions s, employees e WHERE s.EmployeeID = e.EmployeeID AND e.Active = true AND  NOW() < ExpieryTime AND SessionToken = ? LIMIT 1;', [session_token], 
        async (err, rows) => {
            if (err) return rej(err);
            // If the session is not found, return a signed out session.
            if (rows.length != 1) {
                acc({
                    signedIn: false
                })
                return
            }
            
            let r = rows.map(item =>
                Object.assign({}, item, {signedIn: true}),
            )[0]

            // Convert the trust level to an enum.
            r.TrustLevel = string_to_TrustLevel(r.TrustLevel)
            // Refresh the session
            await refresh_session(r)
            acc(r)
        })
    })
}

// Refresh session
async function refresh_session(session) {
    return new Promise((acc, rej) => {
        pool.query('UPDATE sessions SET ExpieryTime = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE SessionToken = ?;', [session.SessionToken], 
        (err, rows) => {
            if (err) return rej(err);
            acc()
        })
    })
}

/**
 * 
 * @param {string} sql_string
 * @param {Array} args
 * @returns {Promise<Object>}
 */
async function query(sql_string, args) {
    return new Promise((acc, rej) => {
        pool.query(sql_string, args, 
        (err, rows) => {
            if (err) return rej(err);

            let r = rows.map(item =>
                Object.assign({}, item, {signedIn: true}),
            )

            acc(r)
        })
    })
}

/**
 * 
 * @param {string} sql_string
 * @param {Array} args
 * @returns {Promise}
 */
async function blind_query(sql_string, args) {
    return new Promise((acc, rej) => {
        pool.query(sql_string, args, 
        (err, rows) => {
            if (err) return rej(err);
            acc()
        })
    })
}


/**
 * 
 * @param {Session} session 
 * @returns {Promise}
 */
async function destroy_session(session) {
    return new Promise((acc, rej) => {
        pool.query('DELETE FROM sessions WHERE SessionToken = ?;', [session.SessionToken], 
        (err, rows) => {
            if (err) return rej(err);
            acc()
        })
    })
}

/** 
 * 
 * @returns {string}
*/
function generate_session_token() {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < 128; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * @param {string} username 
 * @param {string} password 
 * @returns {Session}
 */
async function login(username, password) {
    return new Promise(async (acc, rej) => {
        pool.query("SELECT EmployeeID, Username, PasswordHash FROM employees WHERE Username = ? AND Active = true", [username],
        async (err, rows) => {
            if (err) return rej(err);
            // If the user is not found, return a signed out session.
            if (rows.length != 1) {
                return acc({signedIn: false})
            }
            
            let row = rows[0]
            
            // Check the password
            let valid = await bcrypt.compare(password, row.PasswordHash);
            // If the password is incorrect, return a signed out session.
            if (!valid) {
                acc({signedIn: false})
                return
            }

            // Create a new session
            let token = generate_session_token();
            // Insert the session into the database
            pool.query("INSERT INTO sessions (EmployeeID, SessionToken, ExpieryTime) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))", [row.EmployeeID, token],
            async (err, rows) => {
                if (err) return rej(err);
                // Get the session from the database
                let session = await get_session(token);
                // Return the session
                acc(session)
                return
            })
        })
    })
}

async function change_password(employee_id, old_password, new_password) {
    return new Promise(async (acc, rej) => {
        pool.query("SELECT PasswordHash FROM employees WHERE EmployeeID = ?", [employee_id],
        async (err, rows) => {
            if (err) return rej(err);
            // If the user is not found, dont change the password.
            if (rows.length != 1) {
                return acc("Employee not found.")
            }

            let row = rows[0]
            // Check the password
            let valid = await bcrypt.compare(old_password, row.PasswordHash);
            // If the password is incorrect, dont change the password.
            if (!valid) {
                acc("Old password is incorrect.")
                return
            }
            // Change the password
            let hash = await bcrypt.hash(new_password, 10);
            pool.query("UPDATE employees SET PasswordHash = ? WHERE EmployeeID = ?", [hash, employee_id],
            async (err, rows) => {
                if (err) return rej(err);
                acc(null)
                return
            })
        })
    })
}

async function add_employee(username, password, name, salery, trust) {
    return new Promise(async (acc, rej) => {
        // Check if another employee has the same username
        let users = await get_users();
        for (let user of users) {
            if (user.Username == username) {
                return acc([true, "Username already exists. (Deactivated employee usernames are not available.)"])
            }
        }

        let hash = await bcrypt.hash(password, 10);
        pool.query("INSERT INTO employees (Username, PasswordHash, Name, Salery, HireDate, TrustLevel) VALUES (?, ?, ?, ?, NOW(), ?)", [username, hash, name, salery, TrustLevel_to_string(trust)],
        async (err, rows) => {
            if (err) return rej(err);
            acc([false, "Employee added."])
        })
    }
    )
}


async function add_item(name, description, costPrice, sellingPrice) {
    return new Promise(async (acc, rej) => {
        pool.query("INSERT INTO items (Name, Description, CostPrice, SellingPrice, AddedDate) VALUES (?, ?, ?, ?, NOW())", [name, description, parseInt(costPrice), parseInt(sellingPrice)],
        async (err, rows) => {
            if (err) return rej(err);
            acc()
        })
    }
    )
}

async function hide_item(id) {
    return new Promise(async (acc, rej) => {
        pool.query("UPDATE items SET Hidden = true WHERE ItemSku = ?", [parseInt(id)],
        async (err, rows) => {
            if (err) return rej(err);
            acc()
        })
    }
    )
}

async function show_item(id) {
    return new Promise(async (acc, rej) => {
        pool.query("UPDATE items SET Hidden = false WHERE ItemSku = ?", [parseInt(id)],
        async (err, rows) => {
            if (err) return rej(err);
            acc()
        })
    }
    )
}

async function update_item(id, name, description, costPrice, sellingPrice) {
    return new Promise(async (acc, rej) => {
        pool.query("UPDATE items SET Name = ?, Description = ?, CostPrice = ?, SellingPrice = ? WHERE ItemSku = ?", [name, description, parseInt(costPrice), parseInt(sellingPrice), parseInt(id)],
        async (err, rows) => {
            if (err) return rej(err);
            acc()
        })
    }
    )
}

async function get_items() {
    return new Promise((acc, rej) => {
        pool.query('SELECT * FROM items WHERE Hidden = false', 
        (err, rows) => {
            if (err) return rej(err);

            acc(rows.map(item =>
                Object.assign({}, item),
            ))
        })
    })
}

async function record_sale(employee_id, item_id, quantity) {
    return new Promise((acc, rej) => {
        pool.query('INSERT INTO transactions (EmployeeID, ItemSku, ItemCount, TransactionDate) VALUES (?, ?, ?, NOW())', [employee_id, item_id, quantity], 
        (err, rows) => {
            if (err) return rej(err);
            acc(true)
        })
    })
}

module.exports = {
    get_users,
    get_session,
    login,
    destroy_session,
    TrustLevel,
    string_to_TrustLevel,
    add_employee,
    query,
    blind_query,
    change_password,
    add_item,
    hide_item,
    show_item,
    update_item,
    get_items,
    record_sale
}