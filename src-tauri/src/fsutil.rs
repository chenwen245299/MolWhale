//! Filesystem helpers shared by every storage module.

use std::path::{Component, Path, PathBuf};

/// Write `content` to `path` atomically: write to a uniquely-named temp file in
/// the same directory, then rename it into place. A same-directory rename is
/// atomic on POSIX and Windows, so a crash mid-write can never leave a
/// truncated, unparseable JSON file where config or metadata should be.
///
/// The temp file carries a random suffix so two concurrent writers to the same
/// path don't clobber each other's temp file before the rename.
pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Create directory {}: {e}", parent.display()))?;
    }

    let suffix: String = uuid::Uuid::new_v4()
        .to_string()
        .replace('-', "")
        .chars()
        .take(8)
        .collect();
    let tmp = path.with_extension(format!("tmp.{suffix}"));

    if let Err(e) = std::fs::write(&tmp, content) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("Write temp file {}: {e}", tmp.display()));
    }
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("Rename temp file to {}: {e}", path.display()));
    }
    Ok(())
}

/// Convenience wrapper for writing string content atomically.
pub fn atomic_write_str(path: &Path, content: &str) -> Result<(), String> {
    atomic_write(path, content.as_bytes())
}

/// Read and parse a JSON file, returning `None` when it is missing or corrupt.
///
/// Corrupt is treated as absent on purpose: a half-written metadata file should
/// degrade to "this project has no description yet", not take the whole
/// project list down with it.
pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Option<T> {
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Write a value as pretty-printed JSON, atomically.
pub fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Serialize {}: {e}", path.display()))?;
    atomic_write_str(path, &content)
}

/// Turn a user-supplied name into a filesystem-safe directory name.
///
/// Molecule work is full of names like `Pd(PPh3)4 / ligand screen`, so this
/// keeps unicode (CJK names must survive) and only replaces the characters that
/// are actually illegal or ambiguous in a path.
pub fn slugify(name: &str) -> String {
    let mut slug: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();

    slug = slug.trim().trim_matches('.').trim().to_string();

    // Windows reserves these regardless of extension.
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if RESERVED.iter().any(|r| slug.eq_ignore_ascii_case(r)) {
        slug.push('_');
    }

    if slug.is_empty() {
        slug = "untitled".to_string();
    }
    // Leave headroom for the `-2`, `-3` … disambiguation suffix.
    slug.chars().take(80).collect()
}

/// Pick a directory name under `parent` that is not taken yet, appending
/// `-2`, `-3` … until one is free.
pub fn unique_dir_name(parent: &Path, desired: &str) -> String {
    let base = slugify(desired);
    if !parent.join(&base).exists() {
        return base;
    }
    for n in 2..10_000 {
        let candidate = format!("{base}-{n}");
        if !parent.join(&candidate).exists() {
            return candidate;
        }
    }
    format!("{base}-{}", uuid::Uuid::new_v4())
}

/// Reject a path segment that could escape its parent directory.
///
/// Every id the frontend sends is a directory name that came from
/// `unique_dir_name`, but it arrives over IPC as an arbitrary string — so it is
/// re-validated here rather than trusted.
pub fn safe_segment(segment: &str) -> Result<&str, String> {
    if segment.is_empty() {
        return Err("Empty path segment".to_string());
    }
    let path = PathBuf::from(segment);
    let mut components = path.components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) => Ok(segment),
        _ => Err(format!("Unsafe path segment: {segment}")),
    }
}

/// Current time as an RFC 3339 string — the timestamp format every metadata
/// file in the workspace uses.
pub fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_keeps_cjk_and_chemistry_names() {
        // CJK project names must survive intact — they are the common case.
        assert_eq!(slugify("激酶抑制剂"), "激酶抑制剂");
        // Parentheses and digits are legal in a path and carry meaning here.
        assert_eq!(slugify("Pd(PPh3)4"), "Pd(PPh3)4");
    }

    #[test]
    fn slugify_replaces_path_separators() {
        assert_eq!(slugify("ligand/screen"), "ligand-screen");
        assert_eq!(slugify("a:b*c?d\"e<f>g|h"), "a-b-c-d-e-f-g-h");
    }

    #[test]
    fn slugify_never_returns_something_unusable() {
        assert_eq!(slugify(""), "untitled");
        assert_eq!(slugify("   "), "untitled");
        assert_eq!(slugify("..."), "untitled");
        // Windows reserves these regardless of extension.
        assert_eq!(slugify("CON"), "CON_");
        assert_eq!(slugify("com1"), "com1_");
    }

    #[test]
    fn safe_segment_rejects_traversal() {
        assert!(safe_segment("normal-name").is_ok());
        assert!(safe_segment("激酶抑制剂").is_ok());
        assert!(safe_segment("..").is_err());
        assert!(safe_segment("../escape").is_err());
        assert!(safe_segment("a/b").is_err());
        assert!(safe_segment("/absolute").is_err());
        assert!(safe_segment("").is_err());
    }

    #[test]
    fn unique_dir_name_disambiguates() {
        let dir = std::env::temp_dir().join(format!("molwhale-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();

        assert_eq!(unique_dir_name(&dir, "project"), "project");
        std::fs::create_dir_all(dir.join("project")).unwrap();
        assert_eq!(unique_dir_name(&dir, "project"), "project-2");
        std::fs::create_dir_all(dir.join("project-2")).unwrap();
        assert_eq!(unique_dir_name(&dir, "project"), "project-3");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn atomic_write_leaves_no_temp_file_behind() {
        let dir = std::env::temp_dir().join(format!("molwhale-test-{}", uuid::Uuid::new_v4()));
        let path = dir.join("nested").join("config.json");

        atomic_write_str(&path, "{\"a\":1}").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{\"a\":1}");

        // Overwriting must also clean up after itself.
        atomic_write_str(&path, "{\"a\":2}").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{\"a\":2}");

        let leftovers: Vec<_> = std::fs::read_dir(path.parent().unwrap())
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp."))
            .collect();
        assert!(
            leftovers.is_empty(),
            "temp files left behind: {leftovers:?}"
        );

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
