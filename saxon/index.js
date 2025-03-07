/*
 This Validats a UBL PEPPOL BIS message

 Created: 2021-07-05, Anders Wasén, Qvalia Group AB,
 All rights reserved

Schematrons from: https://github.com/OpenPEPPOL/peppol-bis-invoice-3/tree/master/rules/sch

The process to create the pre-built "sef.json"'s is:

# 1) Access https://github.com/schxslt/schxslt on GitHub and download the XSLT's as a ZIP with XSLT's only from Releases page:
  https://github.com/schxslt/schxslt/releases (download, e.g. schxslt-1.9.5-xslt-only.zip)

# 2) Create a new directory (locally only) and unzip the XSLT's from `schxslt`
# 3) Download the SCH files PEPPOL-EN16931-UBL.sch and CEN-EN16931-UBL.sch
https://raw.githubusercontent.com/OpenPEPPOL/peppol-bis-invoice-3/master/rules/sch/PEPPOL-EN16931-UBL.sch
https://raw.githubusercontent.com/OpenPEPPOL/peppol-bis-invoice-3/master/rules/sch/CEN-EN16931-UBL.sch

# 4) Create a new node project in the directory of `2.0` of the XSLT's (there's one `1.0` directory as well which you can delete)
npm init (just cycle through with Enter, there's no need to add any details)

# 5) Make sure you set the node version you intend to use by creating a `.nvmrc`file, to use v20, do:
echo v20 >> .nvmrc
nvm use

# 6) install dependencies
npm i saxon-js
npm i xslt3

# 7) This will output the compiled sch's as XSLT
./node_modules/.bin/xslt3 -xsl:pipeline-for-svrl.xsl -s:PEPPOL-EN16931-UBL.sch -o:PEPPOL-EN16931-UBL.xslt -t
./node_modules/.bin/xslt3 -xsl:pipeline-for-svrl.xsl -s:CEN-EN16931-UBL.sch -o:CEN-EN16931-UBL.xslt -t

# (Optional 7.1) We can now run any XML against the XSLT, e.g:)
./node_modules/.bin/xslt3 -xsl:PEPPOL-EN16931-UBL.xslt -s:test1.xml -o:result.xml -t

# 8) This is all well and good, but we want a true Node.js solution so we need to pre-process the XSLT into a JSON "ruleset":
./node_modules/.bin/xslt3 -xsl:PEPPOL-EN16931-UBL.xslt -export:PEPPOL-EN16931-UBL.sef.json -t -nogo
./node_modules/.bin/xslt3 -xsl:CEN-EN16931-UBL.xslt -export:CEN-EN16931-UBL.sef.json -t -nogo

Now you have the CEN-EN16931-UBL.sef.json and PEPPOL-EN16931-UBL.sef.json which are the pre-compiled JSON Schematron rules.

*/

const file = require('fs');
const path = require('path');
const SaxonJS = require('saxon-js');
const xml2js = require('xml2js');
const _ = require('lodash');

const { performance } = require('perf_hooks');

async function mapResponse(xml) {
  const j = await xml2js
    .parseStringPromise(xml, { explicitCharkey: true })
    .then(result => result)
    .catch(err => {
      // Failed
      console.log('Failed to create JSON from XML:', err);
    });
  // console.log('j:', JSON.stringify(j));

  const results = {
    success: true,
    mostSevereErrorLevel: 'WARNING',
    items: []
  };
  if (j['svrl:schematron-output']['svrl:failed-assert']) {
    const errObj = j['svrl:schematron-output']['svrl:failed-assert'];
    errObj.forEach(elem => {
      console.log('failed-assert:', elem);

      const ret = {
        errorLevel: _.get(elem, '$.flag'),
        errorID: _.get(elem, '$.id'),
        test: _.get(elem, '$.test'),
        errorText: _.get(elem, '["svrl:text"][0]._')
      };
      if (['error', 'fatal'].includes(ret.errorLevel)) {
        results.mostSevereErrorLevel = 'ERROR';
        results.success = false;
      }
      results.items.push(ret);
    });
  } else {
    results.mostSevereErrorLevel = 'SUCCESS';
  }

  return results;
}

const billingResponse = async (start, valid, valid2, event) => {
  const ret1 = await mapResponse(valid);
  const ret2 = await mapResponse(valid2);

  const success = ret1.success && ret2.success;
  let mostSevereErrorLevel = 'SUCCESS';
  if (ret1.mostSevereErrorLevel === 'ERROR' || ret2.mostSevereErrorLevel === 'ERROR') {
    mostSevereErrorLevel = 'ERROR';
  } else if (ret1.mostSevereErrorLevel === 'WARNING' || ret2.mostSevereErrorLevel === 'WARNING') {
    mostSevereErrorLevel = 'WARNING';
  }
  const durationMS = `${(performance.now() - start).toFixed(0)}ms`;

  return {
    success,
    mostSevereErrorLevel,
    results: [
      {
        success: ret1.success,
        artifactType: 'schematron',
        artifactPath: 'CEN-EN16931-UBL.sch',
        execution: `${event.time['CEN-EN16931-UBL.sef.json']}ms`,
        items: ret1
      },
      {
        success: ret2.success,
        artifactType: 'schematron',
        artifactPath: 'PEPPOL-EN16931-UBL.sch',
        execution: `${event.time['PEPPOL-EN16931-UBL.sef.json']}ms`,
        items: ret2
      }
    ],
    durationMS
  };
};

async function validate(start, xsl, event) {
  console.log('Start SCH validation:', xsl, 'Called at:', performance.now());
  console.time(xsl);


  let strXsl;
  try {
    console.time(`xslRead-${xsl}`);
    const xslPath = path.resolve(
      __dirname,
      `./xsd/${xsl}`
    );
    strXsl = file.readFileSync(xslPath).toString();
    // console.timeEnd(`s3Read-${xsl}`);
    console.timeEnd(`xslRead-${xsl}`);
  } catch (err) {
    throw new Error(err);
  }
  console.time(`runTransform-${xsl}`);
  let ret;
  try {
    const result = await SaxonJS.transform(
      {
        stylesheetText: strXsl,
        sourceText: event.body,
        destination: 'serialized',
        logLevel: 1
      },
      'async' // Run it async, timing works but parallelism seems off... It "waits" but comes back later...
    );
    ret = result.principalResult;
  } catch (err) {
    console.log('SaxonJS.transform:', err);
  }

  console.timeEnd(`runTransform-${xsl}`);
  event.time[xsl] = (performance.now() - start).toFixed(0);
  console.timeEnd(xsl);
  return ret;
}

const peppolValidate = async (event) => {
  console.time('AppDuration');
  console.log('1) Inside peppolValidate()!');
  const start = performance.now();

  event.time = {};
  const args = process.argv.slice(2);
  if (args && args[0]) {
    try {
      event.body = file.readFileSync(args[0]).toString();
    } catch(err) {
      throw new Error(err);
    }
  } else {
    // Read test1.xml file
    event.body = file.readFileSync(path.resolve(
      __dirname,
      './xsd/test1.xml'
    )).toString();
  }

  const [valid, valid2] = await Promise.all([
    validate(start, 'CEN-EN16931-UBL.sef.json', event),
    validate(start, 'PEPPOL-EN16931-UBL.sef.json', event)
  ]);
  ret = await billingResponse(start, valid, valid2, event);
  console.timeEnd('AppDuration');

  return ret;

};

(async () => {
  const result = await peppolValidate({});
  console.dir({ ...result }, {depth: null, colors: true});
})();
