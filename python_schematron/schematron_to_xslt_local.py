"""
Python implementation of the Schematron to XSLT transformer.
Uses SaxonC-HE and local ISO transformation stylesheets.
Uses .temp folder approach instead of tempfile for intermediate files.
"""

import sys
import hashlib
import time
import re
import shutil
from pathlib import Path
from typing import Dict, Optional

try:
    from saxonche import PySaxonProcessor
except ImportError:
    print("Error: SaxonC-HE not found. Please install it with: pip install saxonche")
    sys.exit(1)


class SchematronToXSLTTransformer:
    """Transforms Schematron (.sch) files to XSLT (.xsl) files using the ISO pipeline."""
    
    def __init__(self, base_dir: Optional[str] = None):
        """
        Initialize the transformer.
        
        Args:
            base_dir: Base directory containing ISO transformation stylesheets.
                     If None, uses the local sch_to_xsl_transformers directory.
        """
        if base_dir is None:
            # Use the local sch_to_xsl_transformers directory
            self.base_dir = Path(__file__).parent / "sch_to_xsl_transformers"
        else:
            self.base_dir = Path(base_dir)
        
        self.schematron_dir = Path(__file__).parent / "Schematron"
        self.output_dir = Path(__file__).parent / "xslt_schematron"
        self.cache_dir = Path(__file__).parent / ".cache"
        self.temp_dir = Path(__file__).parent / ".temp"
        
        # Create directories if they don't exist with proper error handling
        try:
            self.output_dir.mkdir(exist_ok=True)
            self.cache_dir.mkdir(exist_ok=True)
            self.temp_dir.mkdir(exist_ok=True)
        except (OSError, PermissionError) as e:
            print(f"Error: Could not create required directories: {e}")
            raise
        
        # ISO transformation stylesheet paths
        self.iso_dsdl_include = self.base_dir / "iso_dsdl_include.xsl"
        self.iso_abstract_expand = self.base_dir / "iso_abstract_expand.xsl" 
        self.iso_svrl_for_xslt2 = self.base_dir / "iso_svrl_for_xslt2.xsl"
        
        # Initialize Saxon processor
        self.processor = PySaxonProcessor(license=False)  # Use HE (Home Edition)
        self.xslt_processor = self.processor.new_xslt30_processor()
        
    def check_requirements(self) -> bool:
        """Check if all required files exist."""
        required_files = [
            self.iso_dsdl_include,
            self.iso_abstract_expand,
            self.iso_svrl_for_xslt2
        ]
        
        missing_files = [f for f in required_files if not f.exists()]
        if missing_files:
            print("Error: Missing required ISO transformation stylesheets:")
            for f in missing_files:
                print(f"  {f}")
            return False
        
        if not self.schematron_dir.exists():
            print(f"Error: Schematron directory not found: {self.schematron_dir}")
            return False
        
        return True
    
    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate MD5 hash of a file."""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def get_cache_info(self, sch_file: Path) -> Dict[str, str]:
        """Get cache information for a Schematron file."""
        cache_file = self.cache_dir / f"{sch_file.stem}.cache"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    lines = f.read().strip().split('\n')
                    if len(lines) >= 2:
                        return {
                            'hash': lines[0],
                            'timestamp': lines[1]
                        }
            except Exception:
                pass
        
        return {}
    
    def save_cache_info(self, sch_file: Path, file_hash: str):
        """Save cache information for a Schematron file."""
        cache_file = self.cache_dir / f"{sch_file.stem}.cache"
        
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                f.write(f"{file_hash}\n")
                f.write(f"{int(time.time())}\n")
        except Exception as e:
            print(f"Warning: Could not save cache info: {e}")
    
    def needs_transformation(self, sch_file: Path) -> bool:
        """Check if Schematron file needs transformation based on MD5 hash."""
        output_file = self.output_dir / f"{sch_file.stem}.xsl"
        
        # If output doesn't exist, definitely need transformation
        if not output_file.exists():
            return True
        
        # Check if input file hash has changed
        current_hash = self.calculate_file_hash(sch_file)
        cache_info = self.get_cache_info(sch_file)
        
        if cache_info.get('hash') != current_hash:
            return True
        
        return False
    
    def run_xslt_transformation(self, source_file: str, xsl_file: str, output_file: str) -> bool:
        """
        Run a single XSLT transformation step.
        
        Args:
            source_file: Input XML file path
            xsl_file: XSLT stylesheet file path  
            output_file: Output file path
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Compile the XSLT stylesheet
            xslt_executable = self.xslt_processor.compile_stylesheet(stylesheet_file=str(xsl_file))
            if not xslt_executable:
                print(f"Error: Failed to compile XSLT: {xsl_file}")
                print(f"Saxon error: {self.processor.error_message}")
                return False
            
            # Execute transformation and save to file
            xslt_executable.transform_to_file(source_file=str(source_file), output_file=str(output_file))
            
            if self.processor.exception_occurred:
                print("Error: XSLT transformation failed")
                print(f"Saxon error: {self.processor.error_message}")
                return False
            
            return True
            
        except Exception as e:
            print(f"Error during XSLT transformation: {e}")
            return False
    
    def add_missing_xsd_namespace(self, xsl_file: Path) -> bool:
        """
        Add missing xmlns:xsd namespace if not present without corrupting existing namespaces.
        Uses text-based approach to preserve namespace prefixes.
        """
        try:
            # Read the file as text
            with open(xsl_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if xsd namespace is already defined
            if 'xmlns:xsd=' in content:
                return False  # Already has xsd namespace
            
            # Find the root element opening tag and add the xsd namespace
            # Look for <xsl:stylesheet or <stylesheet
            
            # Pattern to match the root element opening tag
            root_pattern = r'(<(?:xsl:)?stylesheet[^>]*?)>'
            match = re.search(root_pattern, content)
            
            if match:
                # Add the xsd namespace declaration before the closing >
                old_tag = match.group(0)
                new_tag = old_tag[:-1] + ' xmlns:xsd="http://www.w3.org/2001/XMLSchema">'
                
                # Replace only the first occurrence (root element)
                content = content.replace(old_tag, new_tag, 1)
                
                # Write back to file
                with open(xsl_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                print(f"Adding missing xmlns:xsd namespace to {xsl_file}")
                return True
            else:
                print(f"Warning: Could not find root stylesheet element in {xsl_file}")
                return False
            
        except Exception as e:
            print(f"Warning: Could not check/add xsd namespace: {e}")
            return False
    
    def compare_step_files(self, step_name: str, temp_file: Path):
        """Compare intermediate step files for debugging."""
        print(f"    📄 {step_name}: {temp_file.name}")
        if temp_file.exists():
            file_size = temp_file.stat().st_size
            print(f"       Size: {file_size:,} bytes")
            
            # Show first few lines for verification
            try:
                with open(temp_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()[:3]
                    for i, line in enumerate(lines, 1):
                        print(f"       Line {i}: {line.strip()[:80]}...")
            except Exception:
                pass
    
    def transform_schematron_file(self, sch_file: Path) -> bool:
        """
        Transform a single Schematron file to XSLT using .temp folder.
        Follows the exact same 3-step process as the ISO pipeline.
        """
        print(f"\nTransforming {sch_file.name}...")
        
        # Create temp directory and intermediate file paths
        temp_dir = self.temp_dir
        temp_dir.mkdir(exist_ok=True)
        
        # Define intermediate file paths
        temp_output1 = temp_dir / f"{sch_file.stem}_step1.xml"
        temp_output2 = temp_dir / f"{sch_file.stem}_step2.xml"
        temp_output3 = temp_dir / f"{sch_file.stem}_step3.xml"
        
        try:
            # Step 1: iso_dsdl_include.xsl transformation
            print(f"  Running iso_dsdl_include.xsl transformation on {sch_file}...")
            if not self.run_xslt_transformation(str(sch_file), str(self.iso_dsdl_include), str(temp_output1)):
                return False
            self.compare_step_files("Step 1 output", temp_output1)
            
            # Step 2: iso_abstract_expand.xsl transformation  
            print("  Running iso_abstract_expand.xsl transformation...")
            if not self.run_xslt_transformation(str(temp_output1), str(self.iso_abstract_expand), str(temp_output2)):
                return False
            self.compare_step_files("Step 2 output", temp_output2)

            # Step 3: iso_svrl_for_xslt2.xsl transformation
            print("  Running iso_svrl_for_xslt2.xsl transformation...")
            if not self.run_xslt_transformation(str(temp_output2), str(self.iso_svrl_for_xslt2), str(temp_output3)):
                return False
            self.compare_step_files("Step 3 output", temp_output3)

            # Copy final result to output directory overwriting any existing file
            print("  Copying final result to output directory...")
            output_xsl_path = self.output_dir / f"{sch_file.stem}.xsl"
            
            try:
                if output_xsl_path.exists():
                    print(f"  Deleting existing file: {output_xsl_path}")
                    output_xsl_path.unlink()
                
                # Create parent directory if needed
                output_xsl_path.parent.mkdir(exist_ok=True, parents=True)
                
                # Copy the file (using shutil.copy2 to preserve metadata)
                shutil.copy2(temp_output3, output_xsl_path)
            except (OSError, PermissionError) as e:
                print(f"  ❌ Error copying file: {e}")
                return False

            # Add missing xmlns:xsd namespace if needed
            self.add_missing_xsd_namespace(output_xsl_path)
            
            # Update cache
            file_hash = self.calculate_file_hash(sch_file)
            self.save_cache_info(sch_file, file_hash)
            
            print(f"  ✅ Successfully created {output_xsl_path}")
            
            # Clean up intermediate files (optional - safer cleanup with better error handling)
            for temp_file in [temp_output1, temp_output2, temp_output3]:
                try:
                    if temp_file.exists():
                        temp_file.unlink()
                except (OSError, PermissionError) as e:
                    print(f"  ⚠️ Warning: Could not delete temporary file {temp_file.name}: {e}")
                except Exception:
                    pass  # Keep files for debugging if deletion fails for other reasons
            
            return True
            
        except Exception as e:
            print(f"  ❌ Error transforming {sch_file}: {e}")
            return False
    
    def validate_output(self, sch_file: Path) -> bool:
        """
        Validate the generated XSLT file by checking its size and structure.
        
        Args:
            sch_file: The Schematron file that was transformed
            
        Returns:
            True if the output looks valid, False otherwise
        """
        output_result = self.output_dir / f"{sch_file.stem}.xsl"
        
        if not output_result.exists():
            print(f"  ❌ Output file not found: {output_result}")
            return False
        
        try:
            # Read the file
            with open(output_result, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Basic validation checks
            file_size = len(content)
            print(f"  📊 Generated XSLT: {file_size:,} characters")
            
            # Check if it contains expected XSLT elements
            if '<xsl:stylesheet' not in content and '<stylesheet' not in content:
                print("  ⚠️  Warning: No stylesheet root element found")
                return False
            
            # Check for namespace declarations
            namespace_count = content.count('xmlns:')
            print(f"  📊 Namespace declarations: {namespace_count}")
            
            # Check for template rules
            template_count = content.count('<xsl:template')
            print(f"  📊 Template rules: {template_count}")
            
            if template_count == 0:
                print("  ⚠️  Warning: No template rules found")
                return False
            
            print("  ✅ XSLT file validation passed")
            return True
                
        except Exception as e:
            print(f"  ❌ Error validating output: {e}")
            return False
    
    def transform_all_schematron_files(self, force_rebuild: bool = False) -> bool:
        """
        Transform all Schematron files in the Schematron directory.
        
        Args:
            force_rebuild: If True, rebuild even if cache says it's up to date
            
        Returns:
            True if all transformations succeeded
        """
        if not self.check_requirements():
            return False
        
        # Find all .sch files
        sch_files = list(self.schematron_dir.glob("*.sch"))
        if not sch_files:
            print(f"No .sch files found in {self.schematron_dir}")
            return False
        
        print(f"Found {len(sch_files)} Schematron files:")
        for f in sch_files:
            print(f"  {f.name}")
        
        success_count = 0
        total_files = len(sch_files)
        
        for sch_file in sch_files:
            # Check if transformation is needed
            if not force_rebuild and not self.needs_transformation(sch_file):
                print(f"\n{sch_file.name} is up to date (skipping)")
                success_count += 1
                continue
            
            # Transform the file
            if self.transform_schematron_file(sch_file):
                # Validate the output
                self.validate_output(sch_file)
                success_count += 1
            else:
                print(f"  ❌ Failed to transform {sch_file.name}")
        
        print(f"\n{'='*60}")
        print("TRANSFORMATION SUMMARY")
        print(f"{'='*60}")
        print(f"Total files: {total_files}")
        print(f"Successful: {success_count}")
        print(f"Failed: {total_files - success_count}")
        
        if success_count == total_files:
            print("✅ All transformations completed successfully!")
            print(f"Results saved to: {self.output_dir}")
            return True
        else:
            print(f"❌ {total_files - success_count} transformations failed")
            return False


def main():
    """Command line interface for the Schematron transformer."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Transform Schematron (.sch) files to XSLT (.xsl)")
    parser.add_argument("--force", "-f", action="store_true",
                       help="Force rebuild even if files are up to date")
    parser.add_argument("--base-dir", 
                       help="Base directory containing ISO transformation stylesheets")
    parser.add_argument("--check", action="store_true",
                       help="Check requirements and show status")
    
    args = parser.parse_args()
    
    try:
        # Initialize transformer
        transformer = SchematronToXSLTTransformer(args.base_dir)
        
        if args.check:
            print("Checking requirements...")
            if transformer.check_requirements():
                print("✅ All requirements are met")
                
                # Show file status
                sch_files = list(transformer.schematron_dir.glob("*.sch"))
                if sch_files:
                    print(f"\nFound {len(sch_files)} Schematron files:")
                    for sch_file in sch_files:
                        needs_update = transformer.needs_transformation(sch_file)
                        status = "needs update" if needs_update else "up to date"
                        print(f"  {sch_file.name}: {status}")
                
                sys.exit(0)
            else:
                print("❌ Requirements not met")
                sys.exit(1)
        
        # Run transformations
        start_time = time.time()
        success = transformer.transform_all_schematron_files(args.force)
        end_time = time.time()
        
        print(f"\nTotal time: {end_time - start_time:.2f} seconds")
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\nOperation interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
