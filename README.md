# reusepkg

A CLI tool to reuse Node.js packages across multiple projects by creating symlinks instead of duplicating them. This saves disk space and speeds up project setup by sharing common dependencies.

## 🚀 Features

- **Global Package Store**: Store all installed packages in a centralized location (`~/.reusepkg/store`)
- **Smart Version Management**: Handle multiple versions of the same package separately
- **Cross-Platform Support**: Works on Windows, macOS, and Linux with automatic fallback to copying on Windows
- **Dependency Health Checking**: Detect and fix broken or missing symlinks
- **Cleanup Tools**: Remove unused packages from the global store
- **Beautiful CLI**: Colorful output with emojis and clear status messages

## 📦 Installation

### Global Installation (Recommended)

```bash
# Install globally from npm
npm install -g reusepkg

# Verify installation
reusepkg --version
```

### Using with npx (No Installation Required)

```bash
# Use directly without installation
npx reusepkg --help

# Run commands directly
npx reusepkg link
npx reusepkg doctor
```

### Local Installation

```bash
# Install in a specific project
npm install reusepkg

# Use via npx
npx reusepkg link
```

## 🛠️ Usage

### Basic Commands

```bash
# Link project dependencies from global store
reusepkg link

# Check project dependencies for issues
reusepkg doctor

# List all packages in global store
reusepkg list

# Search for a package in global store and npm
reusepkg search <package-name>

# Clean up unused packages
reusepkg clean

# Uninstall reusepkg and clean global store
reusepkg uninstall
```

### Command Details

#### `reusepkg link`

Reads `package.json` in the current directory and symlinks dependencies from the global store. If a dependency doesn't exist in the global store, it will be installed there first.

```bash
# In your project directory
reusepkg link
```

**What it does:**
- Reads `dependencies`, `devDependencies`, and `peerDependencies` from `package.json`
- Installs missing packages to `~/.reusepkg/store`
- Creates symlinks in `node_modules/` pointing to the global store
- Handles version mismatches by storing packages separately

#### `reusepkg doctor`

Checks project dependencies for issues like missing or broken symlinks.

```bash
reusepkg doctor
```

**What it checks:**
- Missing dependencies in `node_modules/`
- Broken symlinks pointing to non-existent packages
- Offers to fix issues by re-linking dependencies

#### `reusepkg list`

Shows all packages stored in the global store with their versions and status.

```bash
reusepkg list
```

**Output example:**
```
📦 Global store contains 3 packages:

📦 express:
  ✅ 4.18.2 (/Users/username/.reusepkg/store/express/4.18.2)
  ✅ 5.0.0 (/Users/username/.reusepkg/store/express/5.0.0)

📦 lodash:
  ✅ 4.17.21 (/Users/username/.reusepkg/store/lodash/4.17.21)
```

#### `reusepkg search`

Search for a package in both the global store and npm registry.

```bash
reusepkg search <package-name>
```

**What it does:**
- Searches for packages matching the name in the global store
- Checks if the package is available on npm registry
- Shows package information including version, description, and download stats
- Helps you find packages before installing them

**Example:**
```bash
reusepkg search express
```

**Output example:**
```
🔍 Searching for express...
✅ Found 2 package(s) in global store:
  ✅ express@4.18.2 (C:\Users\username\.reusepkg\store\express\4.18.2)
  ✅ express@5.0.0 (C:\Users\username\.reusepkg\store\express\5.0.0)

🌐 Checking npm registry for express...
✅ Package "express" is available on npm:
  📦 Name: express
  📝 Description: Fast, unopinionated, minimalist web framework
  🏷️ Latest Version: 5.1.0
  📊 Downloads: 25,000,000
  🏷️ Keywords: express, framework, sinatra, web, http
```

#### `reusepkg clean`

Removes unused or broken packages from the global store.

```bash
reusepkg clean
```

**What it does:**
- Identifies broken packages (missing from filesystem)
- Detects potentially unused packages
- Asks for confirmation before removal
- Updates the registry after cleanup

#### `reusepkg uninstall`

Uninstalls reusepkg and optionally removes the global store.

```bash
reusepkg uninstall
```

**What it does:**
- Confirms you want to uninstall reusepkg
- Optionally removes the global store (`~/.reusepkg`)
- Provides instructions to complete the uninstall with npm

## 🏗️ How It Works

### Global Store Structure

```
~/.reusepkg/
├── registry.json          # Package registry mapping
└── store/                 # Global package store
    ├── express/
    │   ├── 4.18.2/        # Express v4.18.2
    │   └── 5.0.0/         # Express v5.0.0
    └── lodash/
        └── 4.17.21/       # Lodash v4.17.21
```

### Registry Format

The `registry.json` file maps package names and versions to their store locations:

```json
{
  "express@4.18.2": {
    "name": "express",
    "version": "4.18.2",
    "storePath": "/Users/username/.reusepkg/store/express/4.18.2",
    "installedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Symlink Strategy

- **Linux/macOS**: Uses native symlinks (`fs.symlinkSync`)
- **Windows**: Attempts symlinks first, falls back to copying if permissions don't allow symlinks

## 📋 Use Cases

### Case 1: Same Package, Same Version
```bash
# Project A
cd project-a
reusepkg link  # Installs express@4.18.2 to global store

# Project B  
cd project-b
reusepkg link  # Reuses express@4.18.2 from global store
```

### Case 2: Same Package, Different Versions
```bash
# Project A
cd project-a
reusepkg link  # Installs express@4.18.2

# Project B
cd project-b  
reusepkg link  # Installs express@5.0.0 separately
```

### Case 3: Project Deletion and Cleanup
```bash
# After deleting projects
reusepkg doctor  # Detects broken symlinks
reusepkg clean   # Removes unused packages
```

## 🔧 Configuration

### Environment Variables

- `HOME` (Linux/macOS) or `USERPROFILE` (Windows): Determines global store location
- Default store location: `~/.reusepkg/`

### Package.json Requirements

The tool reads from standard `package.json` fields:
- `dependencies`
- `devDependencies` 
- `peerDependencies`

## 🎉 Official Release

**reusepkg is now officially available on npm!** 🚀

The tool has been tested and verified to work across all major platforms and use cases:
- ✅ Global store initialization
- ✅ Package linking and reuse
- ✅ Version mismatch handling
- ✅ Broken symlink detection
- ✅ Cross-platform compatibility
- ✅ Error handling scenarios

## 🐛 Troubleshooting

### Common Issues

**"No package.json found"**
- Ensure you're running `reusepkg link` in a directory with `package.json`

**"Symlink creation failed"**
- On Windows, the tool will automatically fall back to copying
- Ensure you have write permissions to the project directory

**"Permission denied"**
- Check write permissions for both the global store and project directory
- On Windows, try running as Administrator if symlinks are needed

**"Broken symlinks detected"**
- Run `reusepkg doctor` to identify and fix broken links
- Use `reusepkg clean` to remove orphaned packages

### Debug Mode

For detailed logging, you can modify the tool to add debug output:

```bash
DEBUG=reusepkg* reusepkg link
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/reusepkg.git
   cd reusepkg
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make your changes** and test them:
   ```bash
   node reusepkg.js --help
   ```
5. **Commit your changes**:
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to your fork**:
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request** on GitHub

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/reusepkg.git
cd reusepkg

# Install dependencies
npm install

# Test the tool
node reusepkg.js --help
```

## 🗑️ Uninstalling reusepkg

To completely remove reusepkg from your system:

### Global Uninstall

```bash
# Remove the global package
npm uninstall -g reusepkg

# Clean up global store (optional)
rm -rf ~/.reusepkg  # Linux/macOS
rmdir /s ~/.reusepkg  # Windows
```

### Verify Removal

```bash
# Check if reusepkg is removed
reusepkg --version  # Should show "command not found"

# Check if global store is removed
ls ~/.reusepkg  # Should show "No such file or directory"
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by tools like `pnpm` and `yarn` for efficient package management
- Built with Node.js, Commander.js, Chalk, and Inquirer
- Cross-platform compatibility inspired by modern CLI tools

## 📊 Performance Benefits

- **Disk Space**: Save 50-80% disk space by sharing common dependencies
- **Installation Speed**: Skip re-downloading packages already in global store
- **Development Speed**: Faster project setup and dependency management
- **CI/CD**: Reduced build times in continuous integration environments

---

Made with ❤️ for the Node.js community
