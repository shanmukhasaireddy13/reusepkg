# reusepkg

A CLI tool to reuse Node.js packages across multiple projects by creating symlinks instead of duplicating them. This saves disk space and speeds up project setup by sharing common dependencies.

## 🚀 Features

- **Smart Address Registry**: Tracks package locations without duplicating files
- **Intelligent Package Discovery**: Finds existing installations before installing new ones
- **Cross-Platform Support**: Works on Windows, macOS, and Linux with automatic fallback to copying on Windows
- **Dependency Health Checking**: Detect and fix broken or missing symlinks
- **Address Management**: Clean up broken package addresses from the registry
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
# Install packages (reuses existing installations when possible)
reusepkg install <package-name> [version]
reusepkg i <package-name> [version]

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

#### `reusepkg install` / `reusepkg i`

Install packages by reusing existing installations when possible.

```bash
# Install latest version
reusepkg install express
reusepkg i express

# Install specific version
reusepkg install lodash@4.17.21
reusepkg i lodash@4.17.21
```

**How it works:**
- **First**: Searches for existing installations in common locations
- **If found**: Creates symlink to existing installation (saves space!)
- **If not found**: Installs with npm and stores the path for future reuse
- **Always**: Updates package.json with the dependency

**Smart Reuse Strategy:**
- Searches current directory and parent directories
- Checks common project locations (`~/projects`, `~/workspace`, etc.)
- Looks in global npm modules
- Only installs with npm as a last resort

#### `reusepkg link`

Reads `package.json` in the current directory and processes dependencies intelligently. If a dependency is already available in the global registry, it creates a symlink. If not found, it adds the current project's package address to the registry.

```bash
# In your project directory
reusepkg link
```

**What it does:**
- Reads `dependencies`, `devDependencies`, and `peerDependencies` from `package.json`
- Checks if packages are already available in the global registry
- If found: Creates symlinks to existing installations
- If not found: Adds current project's package address to the registry
- Never stores packages in global store - only tracks addresses

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

Shows all package addresses tracked in the global registry with their locations and status.

```bash
reusepkg list
```

**Output example:**
```
📦 Global registry contains 2 package addresses:

📦 express:
  ✅ 5.1.0 (C:\Users\username\project-a\node_modules\express)
     Source: current-project

📦 axios:
  ✅ latest (C:\Users\username\project-b\node_modules\axios)
     Source: existing-installation
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

Removes broken package addresses from the global registry.

```bash
reusepkg clean
```

**What it does:**
- Identifies broken package addresses (pointing to non-existent locations)
- Shows valid package addresses that are still working
- Asks for confirmation before removing broken addresses
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

### Global Registry Structure

```
~/.reusepkg/
└── registry.json          # Package address registry
```

### Registry Format

The `registry.json` file maps package names and versions to their actual installation locations:

```json
{
  "express@5.1.0": {
    "name": "express",
    "version": "5.1.0",
    "storePath": "/Users/username/project-a/node_modules/express",
    "addedAt": "2024-01-15T10:30:00.000Z",
    "source": "current-project"
  }
}
```

### Smart Address Tracking

- **No Global Store**: reusepkg doesn't store packages in a global location
- **Address Registry**: Only tracks where packages are already installed
- **Intelligent Discovery**: Finds existing installations before installing new ones
- **Space Efficient**: Reuses existing installations via symlinks

### Symlink Strategy

- **Linux/macOS**: Uses native symlinks (`fs.symlinkSync`)
- **Windows**: Attempts symlinks first, falls back to copying if permissions don't allow symlinks

## 📋 Use Cases

### Case 1: Smart Package Linking
```bash
# Project A
cd project-a
npm install express          # Install express normally
reusepkg link               # Adds express address to global registry

# Project B  
cd project-b
reusepkg link               # Finds express in registry, creates symlink!
```

### Case 2: Address-Based Reuse
```bash
# Project A
cd project-a
npm install express@4.18.2  # Install specific version
reusepkg link               # Adds address to registry

# Project B
cd project-b  
npm install express@5.0.0   # Install different version
reusepkg link               # Adds different address to registry
```

### Case 3: Registry Cleanup
```bash
# After deleting projects
reusepkg doctor  # Detects broken symlinks
reusepkg clean   # Removes broken addresses from registry
```

## 🔧 Configuration

### Environment Variables

- `HOME` (Linux/macOS) or `USERPROFILE` (Windows): Determines global registry location
- Default registry location: `~/.reusepkg/`

### Package.json Requirements

The tool reads from standard `package.json` fields:
- `dependencies`
- `devDependencies` 
- `peerDependencies`

## 🎉 Official Release

**reusepkg is now officially available on npm!** 🚀

The tool has been tested and verified to work across all major platforms and use cases:
- ✅ Global registry initialization
- ✅ Smart package discovery and linking
- ✅ Address-based package reuse
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
- Use `reusepkg clean` to remove broken addresses from registry

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

# Clean up global registry (optional)
rm -rf ~/.reusepkg  # Linux/macOS
rmdir /s ~/.reusepkg  # Windows
```

### Verify Removal

```bash
# Check if reusepkg is removed
reusepkg --version  # Should show "command not found"

# Check if global registry is removed
ls ~/.reusepkg  # Should show "No such file or directory"
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by tools like `pnpm` and `yarn` for efficient package management
- Built with Node.js, Commander.js, Chalk, and Inquirer
- Cross-platform compatibility inspired by modern CLI tools

## 📊 Performance Benefits

- **Disk Space**: Save 50-80% disk space by sharing common dependencies via symlinks
- **Installation Speed**: Skip re-downloading packages by reusing existing installations
- **Development Speed**: Faster project setup and dependency management
- **CI/CD**: Reduced build times in continuous integration environments
- **Smart Discovery**: Automatically finds existing packages before installing new ones

---

Made with ❤️ for the Node.js community
