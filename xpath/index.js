const fs = require('fs');
const xml2js = require('xml2js');
const { DOMParser } = require('xmldom');
const xpath = require('xpath2');

const convertUblXmlToUblJson = async (xmlString, options = { explicitArray: true, explicitCharkey: true }) => {
  const parser = new xml2js.Parser(options);
  return parser.parseStringPromise(xmlString);
};

// Load XML and Schematron JSON
(async () => {
  console.time('ReadXmlFile');
  //const xml = await fs.readFileSync('./Large_Invoice_sample2.xml', 'utf-8');
  const xml = await fs.readFileSync('./test_small.xml', 'utf-8');
  console.timeEnd('ReadXmlFile');

  console.time('ReadSchFile');
  const sch = await fs.readFileSync('./xpath/CEN-EN16931-UBL.sch', 'utf-8');
  console.timeEnd('ReadSchFile');

  console.time('xml2js');
  const schJS = await convertUblXmlToUblJson(sch);
  const root = Object.keys(schJS)[0]; // This can be schema, Schema or possibly schematron, so make it dynamic

  const schematronRules = transformSchematron(schJS, root);
  //await fs.writeFileSync('./xpath/schJS.json', JSON.stringify(schematronRules));
  console.timeEnd('xml2js');

  console.time('XMLDom');
  const xmlDoc = new DOMParser().parseFromString(xml);
  console.timeEnd('XMLDom');

  console.time('Validate');
  const validationResults = validateXML(xmlDoc, schematronRules);
  console.timeEnd('Validate');

  console.log('DONE!', validationResults);

})();

function transformSchematron(xmlObject, root) {
  const schematron = { namespaces: {}, patterns: [] };

  if (xmlObject?.[root] && xmlObject[root].pattern) {
    // Add namespaces to Schematron JS as we need them to map XML XPath
    xmlObject[root]?.ns?.forEach((ns) => {
      schematron.namespaces[ns.$.prefix] = ns.$.uri;
    });

    const patterns = Array.isArray(xmlObject[root].pattern)
      ? xmlObject[root].pattern
      : [xmlObject[root].pattern];

    for (const pattern of patterns) {
      const patternObj = {
        id: pattern.$.id,
        rules: []
      };

      if (pattern.rule) {
        const rules = Array.isArray(pattern.rule) ? pattern.rule : [pattern.rule];

        for (const rule of rules) {
          const ruleObj = {
            context: rule.$.context,
            assertions: []
          };

          if (rule.assert) {
            const assertions = Array.isArray(rule.assert) ? rule.assert : [rule.assert];

            for (const assertion of assertions) {
              ruleObj.assertions.push({
                test: assertion.$.test,
                message: assertion._
              });
            }
          }

          patternObj.rules.push(ruleObj);
        }
      }

      schematron.patterns.push(patternObj);
    }
  }

  return schematron;
}

// VALIDATION
// Function to validate XML against Schematron JSON
function validateXML(xmlDoc, schematron) {
  const results = [];
  // Extract namespace mappings
  const namespaces = schematron.namespaces || {};
  // TODO: Add additonal documents, or get the lookup to work on the "bare" paths:
  //         "context": "cac:AccountingCustomerParty/cac:Party/cac:PostalAddress"
  //         "context": "cac:AdditionalDocumentReference"
  //         "context": "/ubl:Invoice/cac:AllowanceCharge[cbc:ChargeIndicator = false()] | /cn:CreditNote/cac:AllowanceCharge
  const xmlRoot = xmlDoc.documentElement.nodeName;
  const msgNs = Object.keys(namespaces).find((n) => namespaces[n].includes(xmlRoot));
  const prefix = msgNs ? `${msgNs}:${xmlRoot}` : xmlRoot;

  for (const pattern of schematron.patterns) {
    for (const rule of pattern.rules) {
      if (!/^\//.test(rule.context)) {
        rule.context = `/${prefix}/${rule.context}`;
      }
      console.log('rule.context:', rule.context);
      //xpath.selectWithResolver = xpath.useNamespaces(namespaces);
      let nodes = xpath.selectWithResolver(rule.context, xmlDoc, createNamespaceResolver(namespaces));

if (rule.context === '//*[ends-with(name(), \'BinaryObject\')]' && nodes?.length > 0) {
  // TODO: Figure this one out...
  // It returns a bunch of nodes for some reason...
  for (node of nodes) {
      if (node.nodeName.includes('BinaryObject')) {
        nodes = [node];
      }
  }
}

      if (nodes.length === 0) {
        // This is an undefined field, as we run a XSD, we'll assume this is OK
        // results.push(formatResult('error', rule.context, 'No matching context found'));
        console.log('NO CONTENT!!!', rule.context);
        continue;
      }
      for (const node of nodes) {
        for (const assertion of rule.assertions) {
          const result = evaluateTest(node, assertion.test, namespaces, prefix);
          if (!result.passed) {
            results.push(formatResult(assertion.severity || 'error', rule.context, assertion.message, result.value));

            console.log('000>>', rule.context, assertion.test, results);


          } else {
            console.log('PASSED!!!', rule.context);

          }
        }
      }
    }
  }

  return results.length ? results : [{ status: 'Validation Passed!' }];
}

// Evaluate an XPath expression with namespace support
function createNamespaceResolver(namespaces) {
  return (prefix) => namespaces[prefix] || null;
}

// Helper to format validation results
function formatResult(severity, context, message, value = null) {
  return {
    severity,
    context,
    message,
    failedValue: value,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19)
  };
}

// Evaluate an XPath expression with custom functions
function evaluateTest(node, test, namespaces, prefix) {
  if (/\(\/\//.test(test)) {
    test = test.replace(/\(\/\//g, `(/${prefix}/`);
  }
  console.log('===>', 'test', test);
  try {
    if (test.startsWith('regex(')) return evaluateRegexTest(node, test, namespaces);
    if (test.startsWith('contains(')) return evaluateContainsTest(node, test, namespaces);
    if (test.match(/\d{4}-\d{2}-\d{2}/)) return evaluateDateTest(node, test, namespaces);
    if (test.includes(' and ') || test.includes(' or ')) return evaluateLogicalTest(node, test);

    const result = xpath.selectWithResolver(test, node, createNamespaceResolver(namespaces));
//console.log('evaluateTest node:', result);
console.log('evaluateTest result:', (typeof result === 'boolean' && result), (Array.isArray(result) && result.length === 0 && !/^\(@[a-z]+\)$/i.test(test)), !!(result && (result?.childNodes || result?.[0]?.childNodes)), /^\(@[a-z]+\)$/i.test(test), result?.[0]?.nodeName );

    // TODO: Figure out why attrinutes are not working for @mimeCode and @filename
    if (/^\(@[a-z]+\)$/i.test(test)) {
      const attr = test.match(/^\(@([a-z]+)\)$/i).at(1);
      if (attr === result?.[0]?.nodeName) {
        return { passed: true, value: result };
      }
    }

    return { passed: Boolean((typeof result === 'boolean' && result) || (Array.isArray(result) && result.length === 0 && !/^\(@[a-z]+\)$/i.test(test)) || !!(result && (result?.childNodes || result?.[0]?.childNodes))), value: result };
  } catch (err) {
    console.error(`Error evaluating test: ${test}`, err);
    return { passed: false, value: null };
  }
}

// Handle "contains" function
function evaluateContainsTest(node, test, namespaces) {
  console.log('===> evaluateContainsTest');

  const containsMatch = test.match(/contains\(([^,]+),\s*['"](.+?)['"]\)/);
  if (!containsMatch) return { passed: false, value: null };

  const [_, field, searchText] = containsMatch;
  const fieldValue = xpath.selectWithResolver(`string(${field})`, node, createNamespaceResolver(namespaces));

  return { passed: fieldValue.includes(searchText), value: fieldValue };
}

// Handle logical expressions
function evaluateLogicalTest(node, test, namespaces) {
  console.log('===> evaluateLogicalTest');

  const conditions = test.split(/\s+(and|or)\s+/);
  let result = evaluateSingleCondition(node, conditions[0], namespaces);

  for (let i = 1; i < conditions.length; i += 2) {
    const operator = conditions[i];
    console.log('operator:', operator);

    const nextCondition = evaluateSingleCondition(node, conditions[i + 1], namespaces);
    console.log('nextCondition:', nextCondition);
    result = operator === 'and' ? result && nextCondition : result || nextCondition;
  }

  return { passed: result, value: null };
}

// Handle single conditions
function evaluateSingleCondition(node, condition, namespaces) {
  try {
      let result = xpath.selectWithResolver(`string(${field})`, node, createNamespaceResolver(namespaces)).trim();
console.log('evaluateSingleCondition result:', result);

      // If result is a node-set or array, extract the first value
      if (Array.isArray(result)) {
          result = result.length > 0 ? result[0].nodeValue || result[0].textContent : null;
      }

      // Convert result to a number if the condition is a numeric comparison
      if (condition.includes(">") || condition.includes("<") || condition.includes("=")) {
          result = Number(result);
      }

      return { passed: Boolean(result), value: result };
  } catch (err) {
      if (err.message.includes('field is not defined')) {
        // This is an undefined field, as we run a XSD, we'll assume this is OK
        return { passed: true, value: null };
      }
      console.error(`Error evaluating condition: ${condition}`, err);
      return { passed: false, value: null };
  }
}
