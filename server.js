"use strict"

const express = require('express');
const sessions = require('client-sessions');
const bodyParser = require('body-parser');
const uuidv1 = require('uuid/v1');
const csp = require('helmet-csp');
const xssFilters = require('xss-filters');
const expressSanitizer = require('express-sanitizer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');

var app = express();

app.use(csp(
	{
		directives:
		{
			defaultSrc:["'self'"],
			scriptSrc:["'self'"],
			imgSrc:["'self'"]
		}
	}));

app.use(bodyParser.urlencoded({ extended: true}));

app.use(expressSanitizer());

app.use(cookieParser());

app.use(sessions(
	{
		cookieName: 'session',
		secret:uuidv1(),
		duration: 30 * 60 * 1000,
		activeDuration: 5 * 60 * 1000,
		httpOnly:true
	}));

function User(username, password, firstname, lastname, address)
{
	this.username = username;
	this.password = password;
	this.firstname = firstname;
	this.lastname = lastname;
	this.address = address;
	this.accounts = [];	
}

function Account(accountnumber, accounttype, initialbalance)
{
	this.accountnumber = accountnumber;
	this.accounttype = accounttype;
	this.balance = initialbalance;
}

app.get('/', function(req, resp){

	if(req.session.username)
	{		
		resp.redirect('/viewdashboard');
	}
	else
	{
		resp.sendFile(__dirname + '/login.html');	
	}

});

app.get('/viewdashboard', function(req, resp){
	if(req.session.username)
	{	
		var userFile = getUserFile(req.session.username);
		fs.readFile(userFile, "utf8", function(error, data)
		{			
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));
			}
			else
			{
				var sessionuser = JSON.parse(data);
				if(sessionuser)
				{
					var returnHtml = "";
					
					returnHtml += "<html>"
					returnHtml += 	"<h1>Welcome to the Online Banking Application</h1>"
		    		returnHtml += 	"<h2>Hello " + xssFilters.inHTMLData(sessionuser.firstname) + " " + xssFilters.inHTMLData(sessionuser.lastname) + "</h2>"  
		    		returnHtml += 	"<table border=1>"
		    		returnHtml += 		"<thead>"
		    		returnHtml += 			"<td>Account number</td>"
		    		returnHtml += 			"<td>Account Type</td>"
		    		returnHtml += 			"<td>Balance</td>"
		    		returnHtml += 		"</thread>"
		    		
		    		for(var account of sessionuser.accounts)
		    		{
		    			returnHtml += "<tr>";
		    			returnHtml += 	"<td>" + xssFilters.inHTMLData(account.accountnumber) + "</td>";
		    			returnHtml += 	"<td>" + xssFilters.inHTMLData(account.accounttype) + "</td>";
		    			returnHtml += 	"<td>" + xssFilters.inHTMLData(account.balance) + "</td>";
		    			returnHtml += "</tr>";
		    		}
		    		returnHtml +=	"</table>";
		    		returnHtml +=   "</br>";
		    		returnHtml +=   "<table>";
		    		returnHtml +=     	"<tr>";
		    		returnHtml +=     		"<td><a href='/viewnewaccount'>New account</a></td>";
		    		returnHtml +=     		"<td><a href='/viewwithdraw'>Withdraw</a></td>";
		    		returnHtml +=     		"<td><a href='/viewdeposit'>Deposit</a></td>";
		    		returnHtml +=     		"<td><a href='/viewtransfer'>Transfer</a></td>";
		    		returnHtml +=     		"<td><a href='/logout'>log out</a></td>";
		    		returnHtml +=     	"</tr>";
		    		returnHtml +=    "<table>";
		    		returnHtml += "</html>";
		
					resp.send(returnHtml);
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});

app.get('/viewdeposit', function(req, resp){
	if(req.session.username)
	{
		var userFile = getUserFile(req.session.username);
		
		fs.readFile(userFile, "utf8", function(error, data)
		{
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));
			}
			else
			{
				var sessionuser = JSON.parse(data);
				if(sessionuser)
				{
					resp.sendFile(__dirname + '/deposit.html');
				}
				else
				{
					resp.send(getMessageHtml("Unable to fetch user file!!!"));
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});

app.get('/viewwithdraw', function(req, resp){
	if(req.session.username)
	{
		var userFile = getUserFile(req.session.username);
		
		fs.readFile(userFile, "utf8", function(error, data)
		{
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));
			}
			else
			{
				var sessionuser = JSON.parse(data);
				if(sessionuser)
				{
					resp.sendFile(__dirname + '/withdraw.html');
				}
				else
				{
					resp.send(getMessageHtml("Unable to fetch user file!!!"));
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});

app.get('/viewtransfer', function(req, resp){
	if(req.session.username)
	{
		var userFile = getUserFile(req.session.username);
		
		fs.readFile(userFile, "utf8", function(error, data)
		{
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));
			}
			else
			{
				var sessionuser = JSON.parse(data);
				if(sessionuser)
				{
					resp.sendFile(__dirname + '/transfer.html');
				}
				else
				{
					resp.send(getMessageHtml("Unable to fetch user file!!!"));
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});

app.get('/viewnewuser', function(req, resp){
	resp.sendFile(__dirname + '/newuser.html');
});

app.get('/viewnewaccount', function(req, resp){
	if(req.session.username)
	{
		resp.sendFile(__dirname + '/newaccount.html');
	}
	else
	{
		resp.redirect('/');		
	}
});



app.post('/login', function(req, resp){
	var username = req.body.username;
	var password = req.body.password;

	if(username.length == 0)
	{
		resp.send(getMessageHtml("User name not valid!!!"));					
	}
	else
	{
		var userFile = getUserFile(username);
		
		if(fs.existsSync(userFile))
		{
			fs.readFile(userFile, "utf8", function(error, data)
			{
				if(error)
				{
					resp.send(getMessageHtml("Error reading user file !!!"));		
				}
				else
				{
					var user = JSON.parse(data);
					
					if(user)
					{
						Object.seal(user);
						
						bcrypt.compare(password, user.password, function(err, res)
						{
							if(err)
							{
								resp.send(getMessageHtml("Unable to compare password !!!"));											
							}
							else
							{
								if(res === true)
								{
									req.session.username = username;
									
									var cookie = req.cookies.username;
									if(!cookie)
									{
										resp.cookie('username', username, { maxAge: 5 * 60 * 1000, httpOnly : true });
										console.log('Cookie created successfully');
									}
									else
									{
										console.log('Cookie found');	
									}
											
									resp.redirect('/viewdashboard');
								}
								else
								{
									resp.send(getMessageHtml("Password mismatch !!!"));
								}		
							}
						});
					}
					else
					{
						resp.send(getMessageHtml("Unable to parse user data !!!"));
					}						
				}
			});
		}
		else
		{
			resp.send(getMessageHtml("User not found!!!"));					
		}
	}
});

app.post('/addnewuser', function(req, resp){
	
	var username = req.sanitize(req.body.username);
	var password = req.sanitize(req.body.password);
	var firstname = req.sanitize(req.body.firstname);
	var lastname = req.sanitize(req.body.lastname);
	var address = req.sanitize(req.body.address);
	var passwordstrength = checkPasswordStrength(password);
	
	if(username.length == 0)
	{
		resp.send(getMessageHtml("User name not valid!!!"));					
	}
	else if(passwordstrength != "proper")
	{
		resp.send(getMessageHtml(passwordstrength));
	}	
	else
	{			
		var userFile = getUserFile(username);
		
		if(fs.existsSync(userFile))
		{
			resp.send(getMessageHtml("User already exists!!!"));					
		}
		else
		{	
			bcrypt.genSalt(10, function(err, salt) {			
				if(err)
				{
					resp.send(getMessageHtml("Error reading user file!!!"));
				}
				else
				{
					bcrypt.hash(password, salt, function(err, hash) {					
						if(err)
						{
							resp.send(getMessageHtml("Unable to hash password!!!"));
						}
						else
						{
							var user = new User(username, hash, firstname, lastname, address);
							
							Object.seal(user);
							
							fs.writeFile(userFile, JSON.stringify(user), function(error) {										
								if(error) {						
									resp.send(getMessageHtml("Error creating user file!!!"));
								}						
								else {
									resp.send(getMessageHtml("User Added!!!"));
								}
							});		
						}
					});
				}
			});
		}
	}	
});

app.post('/addnewaccount', function(req, resp){

	if(req.session.username)
	{
		var userfile = getUserFile(req.session.username);
	
		fs.readFile(userfile, "utf8", function(error, data)
		{
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));					
			}
			else
			{
				var user = JSON.parse(data);
				
				if(user)
				{		
					Object.seal(user);		
					var accountnumber = req.sanitize(req.body.accountnumber);
					var accounttype = req.sanitize(req.body.accounttype);
					var initialbalance = req.sanitize(req.body.initialbalance);
					
					var account = getAccount(user, accountnumber);
					var balance = parseFloat(initialbalance);
					
					if(accountnumber.length == 0)
					{
						resp.send(getMessageHtml("Invalid account number!!!"));				
					}
					else if(isNaN(balance) || balance < 0)
					{
						resp.send(getMessageHtml("Invalid initial balance!!!"));				
					}
					else if(account)
					{
						resp.send(getMessageHtml("Account already exists!!!"));				
					}
					else
					{
						account = new Account(accountnumber, accounttype, balance);
						Object.seal(account);
						user.accounts.push(account);
						
						fs.writeFile(userfile, JSON.stringify(user), function(error)
						{
							if(error)
							{
								resp.send(getMessageHtml("Error updating account to user file!!!"));				
							}
							else
							{
								resp.send(getMessageHtml("Account added!!!"));				
							}
						});
					}	
				}
				else
				{
					resp.send(getMessageHtml("Unable to parse user data!!!"));				
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});

app.post('/deposit', function(req, resp){

	if(req.session.username)
	{
		var userfile = getUserFile(req.session.username);
	
		fs.readFile(userfile, "utf8", function(error, data)
		{	
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));					
			}
			else
			{
				var user = JSON.parse(data);
				
				if(user)
				{
					Object.seal(user);
					var account = getAccount(user, req.body.accountnumber);
					if(account)
					{
						var amount = parseFloat(req.sanitize(req.body.amount));
						var balance = parseFloat(account.balance);
						
						if(isNaN(amount))
						{
							resp.send(getMessageHtml("Invalid amount!!!"));					
						}
						else				
						{
							if(amount <= 0)
							{
								resp.send(getMessageHtml("Invalid deposit amount!!!"));						
							}
							else
							{
								if(isNaN(balance))
								{
									resp.send(getMessageHtml("Invalid balance! Contact bank system adminstrator!!!"));						
								}
								else
								{
									account.balance += amount;					
									
									fs.writeFile(userfile, JSON.stringify(user), function(error)
									{
										if(error)
										{
											resp.send(getMessageHtml("Unable to update the balance to user file!!!"));						
										}
										else
										{
											resp.send(getMessageHtml("Balance updated!!!"));						
										}
									});
								}
							}
						}
					}
					else
					{
						resp.send(getMessageHtml("Invalid account!!!"));				
					}
				}
				else
				{
					resp.send(getMessageHtml("Unable to parse user data!!!"));				
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});

app.post('/withdraw', function(req, resp){
	if(req.session.username)
	{
		var userfile = getUserFile(req.session.username);
	
		fs.readFile(userfile, "utf8", function(error, data)
		{	
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));					
			}
			else
			{
				var user = JSON.parse(data);
				
				if(user)
				{
					Object.seal(user);
					var account = getAccount(user, req.body.accountnumber);
					
					if(account)
					{
						var amount = parseFloat(req.sanitize(req.body.amount));
						var balance = parseFloat(account.balance);
						
						if(isNaN(amount))
						{
							resp.send(getMessageHtml("Invalid amount!!!"));					
						}
						else				
						{
							if(isNaN(balance))
							{
								resp.send(getMessageHtml("Invalid balance! Contact bank system adminstrator!!!"));						
							}
							else
							{
								if(account.balance >= amount)
								{
									account.balance -= amount;					
									
									fs.writeFile(userfile, JSON.stringify(user), function(error)
									{
										if(error)
										{
											resp.send(getMessageHtml("Unable to update the balance to user file!!!"));						
										}
										else
										{
											resp.send(getMessageHtml("Balance updated!!!"));						
										}
									});
								}
								else
								{
									resp.send(getMessageHtml("Insufficient fund!!!"));							
								}
							}
						}
					}
					else
					{
						resp.send(getMessageHtml("Invalid account!!!"));				
					}
				}
				else
				{
					resp.send(getMessageHtml("Unable to parse user data!!!"));				
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});


app.post('/transfer', function(req, resp){

	if(req.session.username)
	{
		var userfile = getUserFile(req.session.username);
	
		fs.readFile(userfile, "utf8", function(error, data)
		{	
			if(error)
			{
				resp.send(getMessageHtml("Error reading user file!!!"));					
			}
			else
			{
				var user = JSON.parse(data);
				
				if(user)
				{
					Object.seal(user);
					var sourceaccount = getAccount(user, req.sanitize(req.body.sourceaccountnumber));
					var targetaccount = getAccount(user, req.sanitize(req.body.targetaccountnumber));
					
					if(sourceaccount && targetaccount)
					{
						var amount = parseFloat(req.sanitize(req.body.transferamount));
						var sourcebalance = parseFloat(sourceaccount.balance);
						var targetbalance = parseFloat(targetaccount.balance);
						
						if(isNaN(amount))
						{
							resp.send(getMessageHtml("Invalid amount!!!"));
						}
						else
						{
							if(isNaN(sourcebalance))
							{
								resp.send(getMessageHtml("Invalid source balance! Contact bank system adminstrator!!!"));
							}
							else if(isNaN(targetbalance))
							{
								resp.send(getMessageHtml("Invalid target balance! Contact bank system adminstrator!!!"));						
							}
							else if(sourcebalance < amount)
							{
								resp.send(getMessageHtml("Insufficient fund in source account!!!"));
							}
							else
							{
								targetaccount.balance += amount;
								sourceaccount.balance -= amount;
								
								fs.writeFile(userfile, JSON.stringify(user), function(error)
								{
									if(error)
									{
										resp.send(getMessageHtml("Unable to update the balance to user file!!!"));						
									}
									else
									{
										resp.send(getMessageHtml("Balance updated!!!"));						
									}
								});
							}
						}
					}
					else
					{
						resp.send(getMessageHtml("Invalid source/target account!!!"));
					}
				}
				else
				{
					resp.send(getMessageHtml("Unable to fetch user information!!!"));				
				}
			}
		});
	}
	else
	{
		resp.redirect('/');
	}
});

app.get('/logout', function(req, resp){
	req.session.reset();
	resp.redirect('/');
});

function getMessageHtml(message)
{
	var returnHtml = "<!DOCTYPE html>";
	returnHtml += "<html>"
    returnHtml += 	"<h2>" + xssFilters.inHTMLData(message) + "</h2>"
	returnHtml += 	"<a href='/viewdashboard'>Home</a>"
	returnHtml += "</html>"
	
	return returnHtml;
}

function checkPasswordStrength(password)
{
	var strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");
	if(password.length < 8)
		return "Password length less than 8 characters";
	else if(password.length > 128)
		return "Password length more than 128 characters";
	else if(strongRegex.test(password) == false)
		return "Password should contain 1 lowercase, 1 uppercase, 1 numeric and 1 special character in password.";
	
	return "proper";
}
function getUserFile(username)
{
	return username + ".json";
}
function getAccount(user, accountnumber)
{
	for(var loop of user.accounts)
	{
		if(loop.accountnumber == accountnumber)
			return loop;
	}
}

app.listen('8080');

