# shematrode
_A playground to try and figure out if it's at all possible to use advanced Schematron with Node.js._

### Background
Schematron is a XML based validation, which can be compiled into an XSLT script/template to apply on XML, and is used to run more advanced validation of XML messages than a normal XML Schema (XSD) allows.

Working with Peppol (an EU standardization for procurement documents based on UBL XML) which has strict validation rules that we must adhere to, and being a Node.js shop, I wanted to do some investigation, and testing if the Schematron templates can be run efficiently in Node.js.
The answer so far, is no, it can't...

In our live environment we use Java (😥) for the Schematron validations as that has libraries for Schematron and runs decently. However, the way the Peppol Schematron is written for Invoice and CreditNote messages the processing of vary large messages becomes reeeaaally slow, and that was what I wanted to try and address using Node.js.
The current implementation we use is based of: https://github.com/phax/ph-schematron/ (and all credit to [Philip Helger](https://github.com/phax)!)


When I first set out investigating I found a few packages on `npm` handling Schematron already but all of them only supported XPath 1.0 and had very limited support for Schematron functions so none of them where alternatives.

I found [saxon-js](https://www.npmjs.com/package/saxon-js) which even supports XSLT 3.0 and works by first "compiling" the Schematron templates into JSON using a combination of Node.js and XSLT. This is done once though, and then you'll use the compiled JSON objects (which are huge!) doing the actual validation in Node.js.

Unfortunately the performance of `saxon-js` wasn't on par either so I started another approach by first parsing the Schematron XSLT's into a JSON equivalent and then use the Node.js implementations of XML DOM and XPath2 to run the actual validations.
This was promising at first, but also hit the speed bump and performance is sadly lacking...

| Runtime  | Library | Size | Time   |
| -------- | ------- | ---- | ------ |
| Java     | Phax    | 10kB | 111 ms |
| Node.js  | Saxon   | 10kB | 550 ms |
| Node.js  | XPath   | 10kB | 127 ms |
| Java     | Phax    | 58MB | 14 min |
| Node.js  | Saxon   | 58MB | N/A    |
| Node.js  | XPath   | 58MB | N/A    |

(*Disclaimer: throwing more CPU and/or memory on the runtimes doesn't affect the runtimes in any higher degree. Samples run on a Ubunutu Linux 22.04 laptop running "Intel Core i9-10885H CPU@2.40GHz" and 64 GB memory. Java JDK v21 16GB max. heap, Node.js v20*)

Neither Node.js implementations can run the 58 MB Invoice message, and that is because the Schematron rules will extract all Invoice Line Items, which is a bit over 63 000, and run calculations on them and then match those calculations to the totals of the Invoice.
What's also "dumb", is that there are several rules in the Schematron that runs through the Line Items, so the loop is run several times, doing more or less "advanced" functions. The way Schematron executes is that it runs loops in loops extracting and keeping values in memory to later return the sum of the calculation, which then is compared to the value of the totals.
Not only totals are calculated, but also VAT and discounts, charges, etc. so there's multiple loops.

### Schematron

For Peppol there are two Schematron files to run, one for EN (European Norm), and another for Peppol specific rules:

[EN16931 Schematron](https://github.com/OpenPEPPOL/peppol-bis-invoice-3/blob/master/rules/sch/CEN-EN16931-UBL.sch)
[Peppol Schematron](https://github.com/OpenPEPPOL/peppol-bis-invoice-3/blob/master/rules/sch/PEPPOL-EN16931-UBL.sch)

A Schematron works in much the same way as a normal unt test framework with patterns that has rules with a context. The context is used to find the object/element to run the rules on, i.e. the data to test. Each rule in turn has assertions with a test, which is the logic to apply to the context.

On top of the Schematron validation we also must run a standard XML Schema (XSD) validation, but this is not an issue in Node.js either, and the XSD validation is fairly quick, and as it can be run in parallel with the Schematron scripts it won't add any time to the total runtime.

### Current State

In the case of the Java implementation and saxon-js, the `sch` files are compiled into runnable objects that are then used to validate the XML's. This means that eh Schematron files are not actually used in runtime, only the pre-compiled objects.

In my latest attempt for Node.js, the one I've called XPath, I instead transform the Schematron XML into a JSON object, which I then tried to "apply" by using the XML DOM and XPath, as Xpath2 can run rules on a XML DOM Node (and that's an XML Node, not Node.js).
I had thought this would be faster, but no, it completely stalls on the "big" rules where it has to fetch a huge number of Line Items.

The `N/A` in the table above means that the code never returned, it keeps on processing, so no heap crash or anything, it just never finnishes (or at least not within an hour, after which I terminated the scripts).
___
#### saxon

The `saxon-js` implementaiton is the one that has gotten the most "love" as I initially thought that was "the one" and it ran failrly ok up to about 20MB Invoices, surpassing the Java one by a lot. However, as the requirments grew and we started seeing a lot of 40+ MB INvoices it was no longer an option as it completely "stalls" at some point around 38-42MB Invoices (or about 40 000 Line Items).

Run:
```shell
node saxon/index.js
```
This will run the Saxon implementation with the sample file under `./saxon/xsd/test1.xml`.
**NB!** I've removed the XSD validation form the code to not "confuse" the main scope of this project...

The Saxon code is fairly OK, and cleaned up to run and do the proper validation. Note that the sample it runs `test1.xml` is purposfully invalid!
If you run the below it'll validate that file successfully:
```shell
node saxon/index.js ./test_small.xml
```
___
#### xpath

**This code is currently a mess and does not fully implement the various assertion tests!**

I've only implemented it far enough to be able to grasp the "performance" of the Line Item tests, which it fails at and "freezes" on larger Invoices.
It will run the function `transformSchematron()` which reads the original Schematron XML and transforms it into a JSON.
I then run a looping function over the JSON Schematron evaluating each rule, by first extracting the context XML Node using XPath and XML DOM.

Run it by:
```shell
node xpath/index.js
```
Which will validate `test_small.xml`.

___
#### strip

**This code is currently a mess and does not fully implement the various assertion tests!**

Run it by:
```shell
node strip/index.js
```
**NB!** This one is actually reading the 58MB Invoice currently!

This is a promising implementation which I started to only get a grasp of how long it actually takes Node.js to loop and summarize the Line Items. Turns out this is about 390ms on my laptop!
However, it is using `xml2js` library and the transform of the 58MB Invoice XML to JSON takes about 6 seconds, so we are "losing" that.
Currently it is reading the `CEN-EN16931-UBL.sch` file from OpenPeppol's GitHub using `fetch` so you might want to use downloaded versions...


___
#### xmldom

**This code is just a bsae implementation to read a DOM and use XPath, but performance is lacking, so a no-go...**

Run it by:
```shell
node xmldom/index.js
```
**NB!** Reading and loading XML DOM object about 5 seconds, which is promising, but XPath is a complete mess and eats memory like crazy and executes very, very slowly on the large file...

20 minutes to extract three XPaths... 🤯

```shell
ReadFile: 239.557ms
DOMParser: 5.033s
useNamespaces: 0.099ms
XPathSelect: 20:04.555 (m:ss.mmm)
```

___
### Requirements

The goal was to be able to run the validation of both Shematron files in **under a minute** for the 58MB Invoice!

The solution must be able to utilize the original Schematron files, either directly, or by "pre-compiling", or transforming them into JSON objects. As Peppol releases two new versions a year, hard-coding each rule in Node.js is not an option, so the Schematron rules must be automatically transformed into usable Node.js artifacts without changing the code.
Functions to process Schematron into JSON/JS which can be deemed "static" until Peppol adds some new, previously unused, Schematon functionality is OK. E.g. if there are functions to parse Schematron into JSON that uses specific logic (see `evaluateSingleCondition()` in `xpath` where only `<`, `>` and `=` is allowed).

I think som combination of `xpath`, to get the transformed Schematron into JSON, and `strip` is probably the way forward to be able to get som performance into this...
