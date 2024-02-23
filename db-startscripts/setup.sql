USE pos;

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS items;

CREATE TABLE items (
	ItemSku int auto_increment,
	
	Name varchar(64) NOT NULL,
	Description varchar(256),
	CostPrice int NOT NULL,
	SellingPrice int NOT NULL,
	Hidden BOOL NOT NULL DEFAULT false,
	AddedDate DATE,
	
	PRIMARY KEY (ItemSku)
);

CREATE TABLE employees (
	EmployeeID int auto_increment,
	
	Name varchar(64),
	Salery int NOT NULL,
	HireDate DATE,
	TrustLevel ENUM("Employee", "Manager", "Owner", "Admin") NOT NULL DEFAULT "Employee",
	
	Username varchar(64) NOT NULL UNIQUE,
	PasswordHash CHAR(60) NOT NULL,
	Active BOOL NOT NULL DEFAULT true,
	
	PRIMARY KEY (EmployeeID)
);

CREATE TABLE sessions (
	SessionID int auto_increment,
	
	EmployeeID int NOT NULL,
	
	SessionToken CHAR(128) NOT NULL,
	ExpieryTime DATETIME NOT NULL,
	
	PRIMARY KEY (SessionID),
	FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID)
);

CREATE TABLE transactions (
	TransactionID int auto_increment NOT NULL,
	ItemSku int NOT NULL,
	EmployeeID int NOT NULL,
	
	TransactionDate DATETIME,
	ItemCount INT NOT NULL DEFAULT 1,
	
	PRIMARY KEY (TransactionID),
	FOREIGN KEY (ItemSku) REFERENCES items(ItemSku),
	FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID)
);

# Admin password Password123 as bcrypt
INSERT INTO employees (Name, Salery, HireDate, TrustLevel, UserName, PasswordHash) VALUES 
("Admin", 0, CURDATE(), "Admin", "Admin", "$2b$12$7s1tTz4x4BoSBlajG/uW1eGOY4ZSt./qFQMd5LE//aXcUnb/ejxau");

# Test item
INSERT INTO items (Name, Description, CostPrice, SellingPrice, AddedDate) VALUES 
("Hamburger", "A simple hamburger with cheese, bacon, salad, and dressing", 50, 70, NOW()),
("Hot Dog", "Idk what to describe it as. Its just a hotdog", 10, 20, NOW()),
("Bagguette", "A bagguete with cheese, salad and ham.", 60, 65, NOW()),
("Water", "Water with free refill.", 0, 5, NOW()),
("Soda", "Some fresh soda.", 10, 15, NOW()),
("Milk", "Fresh cow milk.", 7, 10, NOW()),
("Beer", "A cold beer.", 20, 30, NOW()),
("Wine", "A glass of wine.", 25, 35, NOW()),
("Whiskey", "A glass of whiskey.", 30, 40, NOW()),
("Vodka", "A glass of vodka.", 25, 35, NOW())
;












