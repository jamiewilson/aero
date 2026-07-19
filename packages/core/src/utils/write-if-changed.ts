import fs from 'node:fs'

/** Write `content` only when it differs from the existing file (or the file is missing). */
export function writeIfChanged(filePath: string, content: string): void {
	const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null
	if (prev !== content) fs.writeFileSync(filePath, content, 'utf8')
}
