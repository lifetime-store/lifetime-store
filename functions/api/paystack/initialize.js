import	{	error,	ok,	op onsResponse	}	from	"../../_lib/response.js";	
import	{	readJson,	toFloat	}	from	"../../_lib/parse.js";	
func on	makeOrderNumber()	{	
const	date	=	new	Date().toISOString().slice(0,	10).replaceAll("-",	"");	
const	shortId	=	crypto.randomUUID().slice(0,	8).toUpperCase();	
return	`LT-ORD-${date}-${shortId}`;	
}	
func on	makeReference()	{	
const	shortId	=	crypto.randomUUID().replaceAll("-",	"").slice(0,	12).toUpperCase();	
return	`LT-PS-${Date.now()}-${shortId}`;	
}	
export	async	func on	onRequestOp ons()	{	
return	op onsResponse();	
}	
export	async	func on	onRequestPost(context)	{	
const	env	=	context.env;	
const	body	=	await	readJson(context.request);	
const	{	
customer_name,	
email,	
phone	=	"",	
country	=	"Nigeria",	
city	=	"",	
address	=	"",	
notes	=	"",	
currency	=	"NGN",	
items	=	[],	
shipping	=	0	
}	=	body;	
if	(!env.PAYSTACK_SECRET_KEY)	{	
return	error("PAYSTACK_SECRET_KEY	is	missing	in	Cloudflare	secrets.",	500);	
}	
if	(!customer_name	||	!email	||	!Array.isArray(items)	||	items.length	===	0)	{	
return	error("customer_name,	email,	and	at	least	one	item	are	required.",	400);	
}	
const	subtotal	=	items.reduce((sum,	item)	=>	{	
return	sum	+	(Number(item.unit_price	||	0)	*	Number(item.quan ty	||	1));	
},	0);	
const	shippingValue	=	toFloat(shipping,	0);	
const	total	=	subtotal	+	shippingValue;	
if	(total	<=	0)	{	
return	error("Order	total	must	be	greater	than	zero.",	400);	
}	
const	orderNumber	=	makeOrderNumber();	
const	reference	=	makeReference();	
const	orderInsert	=	await	env.DB.prepare(`	
INSERT	INTO	orders	(	
order_number,	customer_name,	email,	phone,	country,	city,	address,	notes,	currency,	
subtotal,	shipping,	total,	status	
)	VALUES	(?,	?,	?,	?,	?,	?,	?,	?,	?,	?,	?,	?,	?)	
`).bind(	
orderNumber,	
customer_name,	
email,	
phone,	
country,	
city,	
address,	
notes,	
currency,	
subtotal,	
shippingValue,	
total,	
"awai ng_payment"	
).run();	
const	orderId	=	orderInsert.meta?.last_row_id;	
for	(const	item	of	items)	{	
await	env.DB.prepare(`	
INSERT	INTO	order_items	(	
order_id,	product_id,	variant_id,	product_name,	sku,	size,	color,	quan ty,	unit_price,	
currency	
)	VALUES	(?,	?,	?,	?,	?,	?,	?,	?,	?,	?)	
`).bind(	
orderId,	
item.product_id	||	null,	
item.variant_id	||	null,	
item.product_name	||	"Unknown	Product",	
item.sku	||	null,	
item.size	||	"",	
item.color	||	"",	
Number(item.quan ty	||	1),	
Number(item.unit_price	||	0),	
currency	
).run();	
}	
const	origin	=	new	URL(context.request.url).origin;	
const	callbackUrl	=	
`${origin}/api/paystack/verify?order=${encodeURIComponent(orderNumber)}`;	
const	paystackRes	=	await	fetch("h ps://api.paystack.co/transac on/ini alize",	{	
method:	"POST",	
headers:	{	
"Content-Type":	"applica on/json",	
"Authoriza on":	`Bearer	${env.PAYSTACK_SECRET_KEY}`	
},	
body:	JSON.stringify({	
email,	
amount:	Math.round(total	*	100),	
currency:	"NGN",	
reference,	
callback_url:	callbackUrl,	
metadata:	{	
order_number:	orderNumber,	
customer_name,	
customer_phone:	phone	
}	
})	
});	
const	paystackData	=	await	paystackRes.json();	
if	(!paystackRes.ok	||	!paystackData.status	||	!paystackData.data?.authoriza on_url)	{	
await	env.DB.prepare(`	
UPDATE	orders	
SET	status	=	?,	notes	=	?	
WHERE	id	=	?	
`).bind(	
"payment_init_failed",	
`${notes	?	`${notes}	|	`	:	""}Paystack	ini aliza on	failed.`,	
orderId	
).run();	
return	error(paystackData.message	||	"Paystack	ini aliza on	failed.",	500,	paystackData);	
}	
await	env.DB.prepare(`	
UPDATE	orders	
SET	notes	=	?	
WHERE	id	=	?	
`).bind(	
`${notes	?	`${notes}	|	`	:	""}Paystack	reference:	${reference}`,	
orderId	
).run();	
return	ok({	
orderNumber,	
reference,	
authoriza onUrl:	paystackData.data.authoriza on_url,	
accessCode:	paystackData.data.access_code	
});	
}	
