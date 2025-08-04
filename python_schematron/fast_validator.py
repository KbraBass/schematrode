"""
Fast Schematron Validator for PEPPOL Invoice validation.
Uses the local XSLT transformer to generate validation rules dynamically.
Optimized for large XML files with thousands of line items.
"""

import sys
import time
import argparse
import json
from pathlib import Path
from typing import List, Dict, Optional, Any
import xml.etree.ElementTree as ET

try:
    from saxonche import PySaxonProcessor
except ImportError:
    print("Error: SaxonC-HE not found. Please install it with: pip install saxonche")
    sys.exit(1)

# Import our local transformer
from schematron_to_xslt_local import SchematronToXSLTTransformer


class FastSchematronValidator:
    """High-performance Schematron validator using dynamically generated XSLT."""
    
    def __init__(self):
        """Initialize the validator with Saxon processor and transformer."""
        self.processor = PySaxonProcessor(license=False)
        self.xslt_processor = self.processor.new_xslt30_processor()
        self.transformer = SchematronToXSLTTransformer()
        
        # Results directory for JSON outputs
        self.results_dir = Path(__file__).parent / "results"
        self.results_dir.mkdir(exist_ok=True)
        
        # Cache for compiled XSLT executables
        self.xslt_cache: Dict[str, Any] = {}
        
        # Statistics
        self.stats = {
            'total_validations': 0,
            'cache_hits': 0,
            'total_time': 0.0,
            'largest_file_size': 0
        }
    
    def ensure_xslt_generated(self, force_rebuild: bool = False) -> bool:
        """Ensure XSLT files are generated from Schematron files."""
        print("🔄 Checking/generating XSLT files from Schematron...")
        
        start_time = time.time()
        success = self.transformer.transform_all_schematron_files(force_rebuild)
        generation_time = time.time() - start_time
        
        if success:
            print(f"✅ XSLT generation completed in {generation_time:.2f} seconds")
            return True
        else:
            print("❌ XSLT generation failed")
            return False
    
    def get_compiled_xslt(self, xsl_file: Path) -> Optional[Any]:
        """Get compiled XSLT executable, using cache when possible."""
        cache_key = str(xsl_file)
        
        if cache_key in self.xslt_cache:
            self.stats['cache_hits'] += 1
            return self.xslt_cache[cache_key]
        
        if not xsl_file.exists():
            print(f"❌ XSLT file not found: {xsl_file}")
            return None
        
        try:
            print(f"📋 Compiling XSLT: {xsl_file.name}")
            xslt_executable = self.xslt_processor.compile_stylesheet(stylesheet_file=str(xsl_file))
            
            if not xslt_executable:
                print(f"❌ Failed to compile XSLT: {xsl_file}")
                print(f"Saxon error: {self.processor.error_message}")
                return None
            
            # Cache the compiled executable
            self.xslt_cache[cache_key] = xslt_executable
            return xslt_executable
            
        except Exception as e:
            print(f"❌ Error compiling XSLT {xsl_file}: {e}")
            return None
    
    def validate_xml_file(self, xml_file: Path, xsl_files: List[Path]) -> Dict[str, Any]:
        """
        Validate an XML file against multiple XSLT files.
        
        Args:
            xml_file: Path to the XML file to validate
            xsl_files: List of XSLT files to validate against
            
        Returns:
            Dictionary with validation results
        """
        if not xml_file.exists():
            return {'success': False, 'error': f'XML file not found: {xml_file}'}
        
        # Get file size for statistics
        file_size = xml_file.stat().st_size
        self.stats['largest_file_size'] = max(self.stats['largest_file_size'], file_size)
        
        print(f"\n🔍 Validating: {xml_file.name}")
        print(f"📊 File size: {file_size:,} bytes ({file_size/1024/1024:.1f} MB)")
        
        validation_start = time.time()
        results = {
            'xml_file': str(xml_file),
            'file_size': file_size,
            'xslt_results': [],
            'success': True,
            'total_time': 0.0,
            'total_fired_rules': 0,
            'total_failed_assertions': 0,
            'total_successful_reports': 0
        }
        
        for xsl_file in xsl_files:
            if not xsl_file.exists():
                result = {
                    'xslt_file': str(xsl_file),
                    'success': False,
                    'error': f'XSLT file not found: {xsl_file}'
                }
                results['xslt_results'].append(result)
                results['success'] = False
                continue
            
            # Validate against this XSLT
            result = self._validate_against_xslt(xml_file, xsl_file)
            results['xslt_results'].append(result)
            
            if result['success']:
                results['total_fired_rules'] += result.get('fired_rules', 0)
                results['total_failed_assertions'] += result.get('failed_assertions', 0)
                results['total_successful_reports'] += result.get('successful_reports', 0)
            else:
                results['success'] = False
        
        validation_time = time.time() - validation_start
        results['total_time'] = validation_time
        
        self.stats['total_validations'] += 1
        self.stats['total_time'] += validation_time
        
        # Create JSON result file
        self._create_json_result(xml_file, results)
        
        # Print summary
        if results['success']:
            print(f"✅ Validation completed in {validation_time:.3f} seconds")
            print(f"📊 Total fired rules: {results['total_fired_rules']}")
            print(f"📊 Failed assertions: {results['total_failed_assertions']}")
            print(f"📊 Successful reports: {results['total_successful_reports']}")
            
            if results['total_failed_assertions'] == 0:
                print("🎉 XML is VALID - no validation errors found!")
            else:
                print(f"⚠️  XML has {results['total_failed_assertions']} validation errors")
        else:
            print(f"❌ Validation failed in {validation_time:.3f} seconds")
        
        return results
    
    def _validate_against_xslt(self, xml_file: Path, xsl_file: Path) -> Dict[str, Any]:
        """Validate XML file against a single XSLT file."""
        print(f"  🔄 Running {xsl_file.name}...")
        
        start_time = time.time()
        result = {
            'xslt_file': str(xsl_file),
            'success': False,
            'time': 0.0,
            'svrl_output': '',
            'fired_rules': 0,
            'failed_assertions': 0,
            'successful_reports': 0
        }
        
        try:
            # Get compiled XSLT
            xslt_executable = self.get_compiled_xslt(xsl_file)
            if not xslt_executable:
                result['error'] = 'Failed to compile XSLT'
                return result
            
            # Execute transformation
            svrl_output = xslt_executable.transform_to_string(source_file=str(xml_file))
            
            if self.processor.exception_occurred:
                result['error'] = f"XSLT transformation failed: {self.processor.error_message}"
                return result
            
            # Parse SVRL output
            result['svrl_output'] = svrl_output
            result['success'] = True
            result['time'] = time.time() - start_time
            
            # Analyze SVRL results
            self._analyze_svrl_output(svrl_output, result)
            
            print(f"    ✅ Completed in {result['time']:.3f}s - Rules: {result['fired_rules']}, "
                  f"Errors: {result['failed_assertions']}, Reports: {result['successful_reports']}")
            
        except Exception as e:
            result['error'] = str(e)
            result['time'] = time.time() - start_time
            print(f"    ❌ Failed in {result['time']:.3f}s: {e}")
        
        return result
    
    def _analyze_svrl_output(self, svrl_output: str, result: Dict[str, Any]):
        """Analyze SVRL output to extract validation statistics and detailed error information."""
        try:
            # Parse SVRL XML
            root = ET.fromstring(svrl_output)
            
            # Count different types of results
            # Define namespace for SVRL
            ns = {'svrl': 'http://purl.oclc.org/dsdl/svrl'}
            
            # Count fired rules
            fired_rules = root.findall('.//svrl:fired-rule', ns)
            result['fired_rules'] = len(fired_rules)
            
            # Count failed assertions
            failed_assertions = root.findall('.//svrl:failed-assert', ns)
            result['failed_assertions'] = len(failed_assertions)
            
            # Count successful reports
            successful_reports = root.findall('.//svrl:successful-report', ns)
            result['successful_reports'] = len(successful_reports)
            
            # Initialize severity counters
            result['severity_breakdown'] = {
                'fatal': 0,
                'error': 0,
                'warning': 0,
                'info': 0
            }
            
            # Extract detailed error information
            if failed_assertions:
                result['error_details'] = []
                for assertion in failed_assertions:
                    location = assertion.get('location', 'Unknown')
                    test = assertion.get('test', 'Unknown')
                    role = assertion.get('role', 'error')  # Default to 'error' if no role specified
                    
                    text_elem = assertion.find('svrl:text', ns)
                    message = text_elem.text if text_elem is not None else 'No message'
                    
                    # Determine severity based on role or message content
                    severity = self._determine_severity(role, message or 'No message', test)
                    
                    # Count severity
                    if severity in result['severity_breakdown']:
                        result['severity_breakdown'][severity] += 1
                    else:
                        result['severity_breakdown']['error'] += 1  # Default fallback
                    
                    error_detail = {
                        'location': location,
                        'test': test,
                        'message': message,
                        'severity': severity,
                        'role': role
                    }
                    
                    # Extract rule ID if available
                    rule_elem = assertion.find('svrl:rule', ns)
                    if rule_elem is not None:
                        error_detail['rule_id'] = rule_elem.get('id', 'Unknown')
                    
                    result['error_details'].append(error_detail)
        
        except Exception as e:
            print(f"    ⚠️ Warning: Could not parse SVRL output: {e}")
    
    def _determine_severity(self, role: str, message: str, test: str) -> str:
        """Determine error severity based on role, message content, and test."""
        # Check role first (Schematron standard)
        role_lower = role.lower()
        if role_lower in ['fatal', 'error', 'warning', 'info']:
            return role_lower
        
        # Check for severity indicators in message
        message_lower = message.lower()
        if any(word in message_lower for word in ['fatal', 'critical', 'must not', 'required']):
            return 'fatal'
        elif any(word in message_lower for word in ['error', 'invalid', 'violation', 'shall not']):
            return 'error'
        elif any(word in message_lower for word in ['warning', 'should', 'recommend']):
            return 'warning'
        elif any(word in message_lower for word in ['info', 'information', 'note']):
            return 'info'
        
        # Check test for severity indicators
        test_lower = test.lower()
        if 'not(' in test_lower or 'false()' in test_lower:
            return 'error'
        
        # Default to error
        return 'error'
    
    def _create_json_result(self, xml_file: Path, validation_result: Dict[str, Any]) -> None:
        """Create detailed JSON result file for the validation."""
        try:
            # Extract filename without extension for JSON file
            xml_filename = xml_file.stem
            json_filename = f"{xml_filename}_validation_result.json"
            json_file_path = self.results_dir / json_filename
            
            # Prepare detailed JSON structure
            json_result = {
                "validation_metadata": {
                    "xml_file": str(xml_file),
                    "xml_filename": xml_file.name,
                    "file_size_bytes": validation_result['file_size'],
                    "file_size_mb": round(validation_result['file_size'] / 1024 / 1024, 2),
                    "validation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                    "validation_duration_seconds": validation_result['total_time'],
                    "total_xslt_files_processed": len(validation_result['xslt_results'])
                },
                "overall_summary": {
                    "validation_success": validation_result['success'],
                    "total_rules_fired": validation_result['total_fired_rules'],
                    "total_failed_assertions": validation_result['total_failed_assertions'],
                    "total_successful_reports": validation_result['total_successful_reports'],
                    "is_valid": validation_result['success'] and validation_result['total_failed_assertions'] == 0
                },
                "overall_severity_breakdown": {
                    "fatal": 0,
                    "error": 0,
                    "warning": 0,
                    "info": 0
                },
                "schematron_results": []
            }
            
            # Process each XSLT (Schematron) result
            for xslt_result in validation_result['xslt_results']:
                if not xslt_result['success']:
                    continue
                    
                # Extract schematron name from XSLT file path
                xslt_file_path = Path(xslt_result['xslt_file'])
                schematron_name = xslt_file_path.stem  # Remove .xsl extension
                
                # Get severity breakdown for this schematron
                severity_breakdown = xslt_result.get('severity_breakdown', {})
                
                # Add to overall totals
                for severity, count in severity_breakdown.items():
                    if severity in json_result["overall_severity_breakdown"]:
                        json_result["overall_severity_breakdown"][severity] += count
                
                schematron_result = {
                    "schematron_name": schematron_name,
                    "xslt_file": str(xslt_file_path),
                    "processing_time_seconds": xslt_result['time'],
                    "rules_fired": xslt_result['fired_rules'],
                    "failed_assertions": xslt_result['failed_assertions'],
                    "successful_reports": xslt_result['successful_reports'],
                    "severity_breakdown": severity_breakdown,
                    "errors": []
                }
                
                # Add detailed error information
                error_details = xslt_result.get('error_details', [])
                for error in error_details:
                    error_info = {
                        "location": error['location'],
                        "test": error['test'],
                        "message": error['message'],
                        "severity": error['severity'],
                        "role": error['role']
                    }
                    
                    # Add rule ID if available
                    if 'rule_id' in error:
                        error_info['rule_id'] = error['rule_id']
                    
                    schematron_result["errors"].append(error_info)
                
                json_result["schematron_results"].append(schematron_result)
            
            # Write JSON file
            with open(json_file_path, 'w', encoding='utf-8') as f:
                json.dump(json_result, f, indent=2, ensure_ascii=False)
            
            print(f"📄 JSON result saved: {json_file_path.name}")
            
        except Exception as e:
            print(f"⚠️ Warning: Failed to create JSON result file: {e}")
    
    def validate_samples(self, samples_dir: Path, force_rebuild: bool = False) -> List[Dict[str, Any]]:
        """
        Validate all XML files in the samples directory.
        
        Args:
            samples_dir: Path to directory containing sample XML files
            force_rebuild: Whether to force rebuild XSLT files
            
        Returns:
            List of validation results
        """
        print(f"🚀 Fast Schematron Validator - Validating samples in {samples_dir}")
        print("=" * 80)
        
        # Ensure XSLT files are generated
        if not self.ensure_xslt_generated(force_rebuild):
            return []
        
        # Find XSLT files
        xslt_dir = Path(__file__).parent / "xslt_schematron"
        xsl_files = list(xslt_dir.glob("*.xsl"))
        
        if not xsl_files:
            print("❌ No XSLT files found for validation")
            return []
        
        print(f"📋 Found {len(xsl_files)} XSLT files:")
        for xsl_file in xsl_files:
            print(f"  • {xsl_file.name}")
        
        # Find XML sample files
        if not samples_dir.exists():
            print(f"❌ Samples directory not found: {samples_dir}")
            return []
        
        xml_files = list(samples_dir.glob("*.xml"))
        if not xml_files:
            print(f"❌ No XML files found in {samples_dir}")
            return []
        
        print(f"\n📁 Found {len(xml_files)} sample files:")
        for xml_file in xml_files:
            size_mb = xml_file.stat().st_size / 1024 / 1024
            print(f"  • {xml_file.name} ({size_mb:.1f} MB)")
        
        # Validate each file
        all_results = []
        total_start = time.time()
        
        for xml_file in xml_files:
            results = self.validate_xml_file(xml_file, xsl_files)
            all_results.append(results)
        
        total_time = time.time() - total_start
        
        # Print final summary
        self._print_final_summary(all_results, total_time)
        
        return all_results
    
    def _print_final_summary(self, all_results: List[Dict[str, Any]], total_time: float):
        """Print comprehensive validation summary."""
        print("\n" + "=" * 80)
        print("🏁 VALIDATION SUMMARY")
        print("=" * 80)
        
        successful_files = sum(1 for r in all_results if r['success'])
        total_files = len(all_results)
        total_size = sum(r['file_size'] for r in all_results)
        total_fired_rules = sum(r['total_fired_rules'] for r in all_results)
        total_errors = sum(r['total_failed_assertions'] for r in all_results)
        
        print(f"📊 Files processed: {total_files}")
        print(f"✅ Successful validations: {successful_files}")
        print(f"❌ Failed validations: {total_files - successful_files}")
        print(f"📏 Total data processed: {total_size:,} bytes ({total_size/1024/1024:.1f} MB)")
        print(f"🔥 Total rules fired: {total_fired_rules:,}")
        print(f"⚠️  Total validation errors: {total_errors:,}")
        print(f"⏱️  Total time: {total_time:.2f} seconds")
        print(f"🚀 Average speed: {(total_size/1024/1024)/total_time:.1f} MB/second")
        
        if self.stats['cache_hits'] > 0:
            print(f"🎯 XSLT cache hits: {self.stats['cache_hits']}")
        
        # Per-file breakdown
        print("\n📋 Detailed Results:")
        for result in all_results:
            xml_name = Path(result['xml_file']).name
            size_mb = result['file_size'] / 1024 / 1024
            status = "✅ VALID" if result['success'] and result['total_failed_assertions'] == 0 else "❌ INVALID"
            
            if result['success']:
                print(f"  • {xml_name:<25} ({size_mb:>6.1f} MB) - {status} - "
                      f"{result['total_time']:>6.3f}s - "
                      f"Rules: {result['total_fired_rules']:>4}, "
                      f"Errors: {result['total_failed_assertions']:>3}")
            else:
                print(f"  • {xml_name:<25} ({size_mb:>6.1f} MB) - {status} - FAILED")
        
        # Performance analysis
        if total_files > 0:
            avg_time = total_time / total_files
            largest_file = max(all_results, key=lambda x: x['file_size'])
            largest_size = largest_file['file_size'] / 1024 / 1024
            
            print("\n🎯 Performance Analysis:")
            print(f"  • Average time per file: {avg_time:.3f} seconds")
            print(f"  • Largest file processed: {largest_size:.1f} MB")
            print(f"  • Processing speed: {(total_size/1024/1024)/total_time:.1f} MB/second")
            
            # Check if we met the original goal
            if largest_size > 50:  # Large file
                largest_time = largest_file['total_time']
                goal_met = largest_time < 60  # Under 1 minute goal
                status = "🎉 GOAL MET" if goal_met else "⚠️ GOAL MISSED"
                print(f"  • Large file goal (< 60s): {status} ({largest_time:.1f}s)")


def main():
    """Command line interface for the fast validator."""
    parser = argparse.ArgumentParser(description="Fast Schematron Validator for PEPPOL")
    parser.add_argument("--samples-dir", 
                       help="Directory containing sample XML files to validate",
                       default="../Samples")
    parser.add_argument("--force-rebuild", "-f", action="store_true",
                       help="Force rebuild of XSLT files from Schematron")
    parser.add_argument("--single-file", 
                       help="Validate a single XML file instead of all samples")
    
    args = parser.parse_args()
    
    try:
        validator = FastSchematronValidator()
        
        if args.single_file:
            # Validate single file
            xml_file = Path(args.single_file)
            if not xml_file.is_absolute():
                xml_file = Path.cwd() / xml_file
                
            # Ensure XSLT files are generated
            if not validator.ensure_xslt_generated(args.force_rebuild):
                sys.exit(1)
            
            # Find XSLT files
            xslt_dir = Path(__file__).parent / "xslt_schematron"
            xsl_files = list(xslt_dir.glob("*.xsl"))
            
            if not xsl_files:
                print("❌ No XSLT files found for validation")
                sys.exit(1)
            
            # Validate the file
            result = validator.validate_xml_file(xml_file, xsl_files)
            
            # Exit with appropriate code
            sys.exit(0 if result['success'] and result['total_failed_assertions'] == 0 else 1)
        
        else:
            # Validate all samples
            samples_dir = Path(args.samples_dir)
            if not samples_dir.is_absolute():
                samples_dir = Path.cwd() / samples_dir
            
            results = validator.validate_samples(samples_dir, args.force_rebuild)
            
            # Exit with appropriate code
            all_valid = all(r['success'] and r['total_failed_assertions'] == 0 for r in results)
            sys.exit(0 if all_valid else 1)
    
    except KeyboardInterrupt:
        print("\n🛑 Validation interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"💥 Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()