var express = require('express');
var router = express.Router();
var Firebase = require("firebase");
var ref = new Firebase("https://blazing-inferno-9634.firebaseio.com/");
var accountSid = 'ACf30c3b302e9125a8f8674684ee3a5d79'; 
var authToken = '5d274667e533974b31448ea15b5e5e97'; 
var cors = require('cors');

var client = require('twilio')(accountSid, authToken); 


// Set your secret key: remember to change this to your live secret key in production
// See your keys here https://dashboard.stripe.com/account
var stripe = require("stripe")("sk_test_bpA5ipmE7UCIHOX0lTpD3DvM");

// array of shovler phone numbers
var phoneArr = [];


// firebase listener
ref.child('shovlers').on('value',function(data){
	// gets shovler obj
	var shovlers = data.val();

	// get phone numbers from shovler obj and store in array
	for (key in shovlers){
		if (shovlers.hasOwnProperty[key]){
			var num = takeOutDashes(shovlers[key].phone).toString();
			phoneArr.push(num);
		}
	}
});


// takes dashes out of phone numbers
var takeOutDashes = function(numWithDashes){
	return numWithDashes.replace(/-/g, "");
};


// Get the credit card details submitted by the form
router.get('/:userId', function(req, res) {
	var user_id = req.params.userId;

	console.log("userID ", user_id);

	// get user of that userID from Firebase
	ref.child('users').child(user_id).child('customerID').once('value',function(data){
		
		var userStripe = data.val();
		console.log('data: ', data.val());
		console.log("userStripe: ", userStripe);

		if (userStripe){
			// if they have a card stored, get the last 4 digits and brand
			stripe.customers.retrieve(userStripe, function(err, customer) {
	  			var last = customer.cards.data[0].last4;
	  			var brand = customer.cards.data[0].brand;
	  			console.log("last ", last);
	  			console.log("brand ", brand);
	  			res.json(200, {last: last, brand: brand});
			});
		}
	});
});


// create customer Stripe token
router.post('/', cors(), function(req, res) {
	var stripeToken = req.body.stripeToken;
	var user_id = req.body.userId;

	console.log("stripe token: ", stripeToken);
	console.log("user: ", user_id);


	// create a stripe customer object with token
	stripe.customers.create({
		card: stripeToken,
		description: 'Shovel booking'
	}, function(err, customer) {
		
		console.log("in post: ", customer.id);
		console.log("stripe token: ", stripeToken);
		console.log("user: ", user_id);

		if (err){
			console.log(err);
		}

		else{
		// store customer id so you can use it later
		ref.child('users').child(user_id).update({customerID: customer.id},function(){
			console.log("we are happy, and got money");
			res.json(200,{});
		});
		}
	});  	
});


// charge customer credit card
router.post('/charge', function(req, res){

	console.log("BODY: ", req.body);

	// get stripe customer_id
	var user_id = req.body.userId;
	var amount = parseInt(req.body.amount) * 100;
	var customer_id = "";



	// get customer_id from stripe customer
	ref.child('users').child(user_id).child('customerID').once('value',function(data){
		console.log("data ", data.val());
		customer_id = data.val();
		console.log(customer_id);

		// create a new charge
		stripe.charges.create({
		  amount: amount, // amount in cents, again
		  currency: "usd",
		  customer: customer_id
		}).then(function(err) {
			console.log("end: ", err);
			res.send(200);
		}, function(err) {
			console.log(err);
		});

	});
});


// send text msgs using twilio api
var sendTxt = function(arrNum, msg){
 	// make a comma separated string of the phone numbers
 	var nums = arrNum.join();

 	console.log("nums: ", nums);

 	// create and send messages
	client.messages.create({  
		from: "+12407536545",    
		to: nums,
		body: msg
	}, function(err, message) { 
		console.log("message ID: ", message.sid); 
	});
}

// when job is accepted/finished by shoveler, inform client they are on the way
router.post('/job', function(req, res){
	// get vars from body
	var phone = req.body.phone;
	var shovler = req.body.shovlerName;
	var client = req.body.clientName;
	var status = req.body.status;

	console.log("body: ", req.body);


	var phoneNum = [takeOutDashes(phone)];

	// create message to send to client
	if (status === "accepted"){
		var msg = "Hi " + client + "!  Just wanted to let you know that " + shovler + " is on his way to shovel your driveway!";
	}

	else{
		var msg = "Hi " + client + "!  " + shovler + " is done with  shoveling.  Please pay and rate him using the Shovel app.  Thanks!";
	}

	// send text to client
	sendTxt(phoneNum, msg);

	res.send(200);
});


// when job request is made, send text to all shovelers
router.post('/request', function(req, res){
	// get vars from body
	var addr = req.body.addr;
	var msg = "Hi! You have a new Shovel request! Check the Shovel app to accept!"

	phoneStr = phoneArr.join(",");

	sendTxt(phoneStr, msg);
});


module.exports = router;
