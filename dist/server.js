exports = globalThis.exports;
let node_fs_promises = require("node:fs/promises");
// ../../../packages/lib/src/server/rateLimit.ts
var SourceLock = class {
	active = new Set();
	async run(source, busy, task) {
		if (this.active.has(source)) return busy;
		this.active.add(source);
		try {
			return await task();
		} finally {
			this.active.delete(source);
		}
	}
	release(source) {
		this.active.delete(source);
	}
}, RateLimit = class {
	count;
	windowMs;
	hits = new Map();
	constructor(count, windowMs) {
		this.count = count, this.windowMs = windowMs;
	}
	take(source) {
		let now = GetGameTimer(), recent = (this.hits.get(source) ?? []).filter((at) => now - at < this.windowMs);
		return recent.length >= this.count ? (this.hits.set(source, recent), !1) : (recent.push(now), this.hits.set(source, recent), !0);
	}
	release(source) {
		this.hits.delete(source);
	}
};
// ../../../packages/lib/src/shared/read.ts
function num(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num(value, fallback, min, max));
}
function bool(value, fallback) {
	return typeof value == "boolean" ? value : fallback;
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
const asArgs = (value) => value === null ? null : [value];
function createLogger(resource) {
	let prefix = `[${resource}]`;
	return {
		info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
		warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
		error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
	};
}
function withoutSchemaKey(value) {
	if (!isRecord(value) || !("$schema" in value)) return value;
	let { $schema: _schema, ...rest } = value;
	return rest;
}
var DataFile = class {
	resource;
	name;
	log;
	writes = Promise.resolve();
	pending = void 0;
	timer = null;
	schemaRef = null;
	constructor(resource, name, log) {
		this.resource = resource, this.name = name, this.log = log;
	}
	hasSchemaRef() {
		return (LoadResourceFile(this.resource, this.path) ?? "").includes("\"$schema\"");
	}
	read() {
		for (let path of [this.path, `${this.path}.bak`]) {
			let raw = LoadResourceFile(this.resource, path);
			if (raw) try {
				return withoutSchemaKey(JSON.parse(raw));
			} catch (error) {
				this.log.error(`${this.resource}/${path} is not valid JSON${path === this.path ? ", trying the backup" : ""}`, error);
			}
		}
		return null;
	}
	write(value) {
		this.pending = value, this.timer ||= setTimeout(() => {
			this.timer = null;
			let data = this.schemaRef && isRecord(this.pending) ? {
				$schema: this.schemaRef,
				...this.pending
			} : this.pending, text = `${JSON.stringify(data, null, 2)}\n`;
			this.writes = this.writes.then(() => this.flush(text)).catch((error) => this.log.error(`saving ${this.resource}/${this.path} failed`, error));
		}, 250);
	}
	get path() {
		return `data/${this.name}.json`;
	}
	async flush(text) {
		let file = `${GetResourcePath(this.resource)}/${this.path}`;
		await (0, node_fs_promises.mkdir)(file.slice(0, file.lastIndexOf("/")), { recursive: !0 }), await (0, node_fs_promises.writeFile)(`${file}.tmp`, text, "utf8"), await (0, node_fs_promises.copyFile)(file, `${file}.bak`).catch(() => void 0), await (0, node_fs_promises.rename)(`${file}.tmp`, file);
	}
};
// ../../../packages/shared/src/core.ts
const CORE = {
	resource: "ai-core",
	clientErrorEvent: "ai-core:clientError",
	playerLoadedEvent: "ai-core:playerLoaded",
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	clientCharacterLookEvent: "ai-core:client:characterLook",
	clientPromptPressedEvent: "ai-core:client:promptPressed",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	clientNotifyEvent: "ai-core:client:notify",
	spawnEvent: "ai-core:client:spawn",
	openCharactersEvent: "ai-core:client:openCharacters"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
};
// ../../../packages/lib/src/fivem/exports.ts
function registerExport(name, handler) {
	globalThis.exports(name, handler);
}
function resourceExport(resource) {
	return globalThis.exports[resource];
}
function isResourceStarted(resource) {
	return GetResourceState(resource) === "started";
}
function optionalExport(resource) {
	return isResourceStarted(resource) ? globalThis.exports[resource] : null;
}
function provideExport(resource, name, fn) {
	on(`__cfx_export_${resource}_${name}`, (setCallback) => setCallback(fn));
}
function readLocaleFile(resource, lang) {
	let raw = LoadResourceFile(resource, `locales/${lang}.json`);
	if (!raw) return {};
	let parsed = JSON.parse(raw);
	if (!isRecord(parsed)) return {};
	let texts = {};
	for (let [key, value] of Object.entries(parsed)) typeof value == "string" && (texts[key] = value);
	return texts;
}
function createLocale() {
	let texts = loadLocaleTexts();
	return (key, ...args) => formatText(texts[key] ?? key, args);
}
function loadLocaleTexts(resource = GetCurrentResourceName()) {
	let lang = GetConvar("ai:locale", "en"), texts = {
		...readLocaleFile(resource, "en"),
		...lang === "en" ? {} : readLocaleFile(resource, lang)
	};
	for (let key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
	return texts;
}
// ../../../packages/lib/src/fivem/callbackNames.ts
const requestEvent = (name) => `aicore:cb:${name}`, responseEvent = (resource) => `aicore:cbr:${resource}`;
resourceExport(CORE.resource);
const log$7 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source)) || !this.limit.take(source)) return null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, `invalid arguments ${logSafe(JSON.stringify(raw) ?? "", 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source);
	}
	refuse(source, reason) {
		log$7.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${reason}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$6 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
function onClientCallback(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 20);
	onNet(requestEvent(name), async (caller, id, ...raw) => {
		let source = Number(globalThis.source);
		if (typeof caller != "string" || caller.length > 64 || typeof id != "number") return;
		let args = gate.check(source, raw);
		if (!args) return emitNet(responseEvent(caller), source, id, !1, null);
		try {
			let result = await gate.run(source, REFUSED, () => handler(source, ...args));
			result === REFUSED ? emitNet(responseEvent(caller), source, id, !1, null) : emitNet(responseEvent(caller), source, id, !0, result ?? null);
		} catch (error) {
			log$6.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
		}
	});
}
const pending = new Map();
onNet(responseEvent(resource$1), (id, ok, result) => {
	let entry = typeof id == "number" ? pending.get(id) : void 0;
	entry && entry.source === Number(globalThis.source) && (pending.delete(id), clearTimeout(entry.timer), ok === !0 ? entry.resolve(result) : entry.reject(Error("client callback failed")));
});
// ../../../packages/lib/src/server/admin/patch.ts
function toPatch(value) {
	if (!isRecord(value) || typeof value.file != "string") return null;
	let key = typeof value.key == "string" ? value.key : void 0;
	switch (value.action) {
		case "set": return typeof value.section == "string" ? {
			file: value.file,
			action: "set",
			key,
			section: value.section,
			value: value.value
		} : null;
		case "create": return key && typeof value.label == "string" ? {
			file: value.file,
			action: "create",
			key,
			label: value.label
		} : null;
		case "delete": return key ? {
			file: value.file,
			action: "delete",
			key
		} : null;
		case "import": {
			if (!isRecord(value.records)) return null;
			let records = {};
			for (let [k, v] of Object.entries(value.records)) isRecord(v) && (records[k] = v);
			return Object.keys(records).length > 0 && Object.keys(records).length <= 500 ? {
				file: value.file,
				action: "import",
				records
			} : null;
		}
		default: return null;
	}
}
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$8 = resourceExport(CORE.resource), ERR = {
	type: "ADMIN_ERR_TYPE",
	range: "ADMIN_ERR_RANGE",
	length: "ADMIN_ERR_LENGTH",
	pattern: "ADMIN_ERR_PATTERN",
	required: "ADMIN_ERR_REQUIRED",
	lookup: "ADMIN_ERR_LOOKUP"
}, lookups = new class {
	lists = new Map();
	values(source) {
		let cached = this.lists.get(source);
		if (cached && Date.now() - cached.at < 2e3) return cached.values.size > 0 ? cached.values : null;
		let list = [];
		try {
			list = core$8.GetLookupValues(source);
		} catch {}
		let values = new Set(Array.isArray(list) ? list.filter((v) => typeof v == "string") : []);
		return this.lists.set(source, {
			at: Date.now(),
			values
		}), values.size > 0 ? values : null;
	}
}(), isVec = (value, keys) => isRecord(value) && keys.every((k) => typeof value[k] == "number" && Number.isFinite(value[k]));
function validate(spec, value, path) {
	if (value == null) return spec.optional ? null : {
		error: ERR.required,
		path
	};
	let fail = (error) => ({
		error,
		path
	});
	switch (spec.type) {
		case "text": return typeof value == "string" ? value.length < (spec.min ?? 1) || value.length > (spec.max ?? 120) ? fail(ERR.length) : spec.pattern && !new RegExp(spec.pattern).test(value) ? fail(ERR.pattern) : spec.lookup && value !== "" && lookups.values(spec.lookup)?.has(value) === !1 ? fail(ERR.lookup) : null : fail(ERR.type);
		case "number": return typeof value != "number" || !Number.isFinite(value) || spec.integer && !Number.isInteger(value) ? fail(ERR.type) : spec.min !== void 0 && value < spec.min || spec.max !== void 0 && value > spec.max ? fail(ERR.range) : null;
		case "bool": return typeof value == "boolean" ? null : fail(ERR.type);
		case "enum": return spec.values.includes(value) ? null : fail(ERR.type);
		case "names": {
			if (!Array.isArray(value) || value.length > (spec.max ?? 50)) return fail(ERR.length);
			let pattern = new RegExp(spec.pattern ?? "^[\\w.:-]+$"), seen = new Set();
			for (let name of value) {
				if (typeof name != "string" || name.length > (spec.itemMax ?? 64) || seen.has(name)) return fail(ERR.type);
				if (!pattern.test(name)) return fail(ERR.pattern);
				if (spec.lookup && lookups.values(spec.lookup)?.has(name) === !1) return fail(ERR.lookup);
				seen.add(name);
			}
			return null;
		}
		case "vec3": return isVec(value, [
			"x",
			"y",
			"z"
		]) ? null : fail(ERR.type);
		case "vec4": return isVec(value, [
			"x",
			"y",
			"z",
			"heading"
		]) ? null : fail(ERR.type);
		case "object":
			if (!isRecord(value)) return fail(ERR.type);
			for (let key of Object.keys(value)) if (!(key in spec.fields)) return {
				error: ERR.type,
				path: `${path}.${key}`
			};
			for (let [key, field] of Object.entries(spec.fields)) {
				let refusal = validate(field, value[key], `${path}.${key}`);
				if (refusal) return refusal;
			}
			return null;
		case "list":
			if (!Array.isArray(value)) return fail(ERR.type);
			if (value.length < (spec.min ?? 0) || value.length > (spec.max ?? 100)) return fail(ERR.length);
			for (let i = 0; i < value.length; i++) {
				let refusal = validate(spec.of, value[i], `${path}.${i + 1}`);
				if (refusal) return refusal;
			}
			return null;
		default: return spec;
	}
}
// ../../../packages/lib/src/server/admin/jsonSchema.ts
const SCHEMA_KEY = {
	type: "string",
	description: "This file's JSON Schema (for editors)."
};
function langFile(resource) {
	try {
		let raw = JSON.parse(LoadResourceFile(resource, "locales/en.json") ?? "{}");
		return isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter((e) => typeof e[1] == "string")) : {};
	} catch {
		return {};
	}
}
function texts$1(resource) {
	return {
		...langFile("ai-core"),
		...langFile(resource)
	};
}
function collect(fields, prefix, lang, out) {
	for (let field of fields) {
		let path = prefix + field.path, label = lang[field.label] ?? field.label, hint = field.hint ? lang[field.hint] ?? field.hint : "";
		out.has(path) || out.set(path, hint ? `${label}: ${hint}` : label), field.widget === "list" && collect(field.rows, `${path}[].`, lang, out);
	}
}
function describe(schema, file, lang) {
	let out = new Map();
	for (let tab of schema.tabs) if (tab.file === file) for (let card of tab.cards) collect(card.fields, "", lang, out);
	return out;
}
function toJson(spec, path, desc) {
	let description = desc.get(path), base = description ? { description } : {};
	switch (spec.type) {
		case "text": return {
			...base,
			type: "string",
			minLength: spec.min,
			maxLength: spec.max,
			pattern: spec.pattern
		};
		case "number": return {
			...base,
			type: spec.integer ? "integer" : "number",
			minimum: spec.min,
			maximum: spec.max
		};
		case "bool": return {
			...base,
			type: "boolean"
		};
		case "enum": return {
			...base,
			enum: spec.values
		};
		case "names": return {
			...base,
			type: "array",
			maxItems: spec.max,
			uniqueItems: !0,
			items: {
				type: "string",
				maxLength: spec.itemMax,
				pattern: spec.pattern
			}
		};
		case "vec3":
		case "vec4": {
			let keys = spec.type === "vec3" ? [
				"x",
				"y",
				"z"
			] : [
				"x",
				"y",
				"z",
				"heading"
			];
			return {
				...base,
				type: "object",
				required: keys,
				properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }]))
			};
		}
		case "object": return {
			...base,
			...objectOf(spec.fields, path ? `${path}.` : "", desc)
		};
		case "list": return {
			...base,
			type: "array",
			minItems: spec.min,
			maxItems: spec.max,
			items: toJson(spec.of, `${path}[]`, desc)
		};
		default: return spec;
	}
}
function objectOf(fields, prefix, desc) {
	return {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, toJson(s, prefix + k, desc)])),
		required: Object.entries(fields).filter(([, s]) => !s.optional).map(([k]) => k)
	};
}
function fileSchema(resource, schema, name, spec) {
	let desc = describe(schema, name, texts$1(resource)), title = `${resource}/data/${name}.json`, body = spec.kind === "settings" ? (() => {
		let obj = objectOf(spec.sections, "", desc), required = obj.required.filter((k) => !(k in (spec.defaults ?? {})));
		return {
			...obj,
			properties: {
				$schema: SCHEMA_KEY,
				...obj.properties
			},
			required
		};
	})() : {
		type: "object",
		properties: { $schema: SCHEMA_KEY },
		patternProperties: { [spec.keyPattern ?? "^[a-z0-9_]{2,32}$"]: objectOf(spec.sections, "", desc) },
		additionalProperties: !1
	};
	return `${JSON.stringify({
		$schema: "http://json-schema.org/draft-07/schema#",
		title,
		...body
	}, null, 2)}\n`;
}
function writeSchema(resource, name, text, log) {
	let path = `data/schemas/${name}.schema.json`;
	if (LoadResourceFile(resource, path) === text) return;
	let dir = `${GetResourcePath(resource)}/data/schemas`;
	(0, node_fs_promises.mkdir)(dir, { recursive: !0 }).then(() => (0, node_fs_promises.writeFile)(`${dir}/${name}.schema.json`, text, "utf8")).catch((error) => log.error(`writing ${resource}/${path} failed`, error));
}
// ../../../packages/lib/src/server/admin/panel.ts
const core$7 = resourceExport(CORE.resource), DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges)), setImmediate(() => core$7.RegisterAdminPanel(this.resource));
	}
	get(file) {
		return this.data.get(file) ?? {};
	}
	onChange(file, handler) {
		this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
	}
	rule(file, rule) {
		this.rules.set(file, rule);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: clone(Object.fromEntries(this.data))
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec || spec.memory) return {
			ok: !1,
			error: ERR.type
		};
		let error = this.check(patch, spec);
		return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${JSON.stringify(patch).slice(0, 300)}`), {
			ok: !1,
			error
		}) : (this.store(patch, spec), { ok: !0 });
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	linked(spec, value) {
		return spec.type === "text" && spec.records && typeof value == "string" && value !== "" && !(value in this.get(spec.records)) ? "ADMIN_ERR_LOOKUP" : null;
	}
	check(patch, spec) {
		let data = this.get(patch.file);
		if (patch.action === "create") return spec.kind !== "records" || !new RegExp(spec.keyPattern ?? DEFAULT_KEY).test(patch.key) ? ERR.pattern : patch.key in data ? "ADMIN_ERR_EXISTS" : null;
		if (patch.action === "delete") return spec.kind !== "records" || !(patch.key in data) ? ERR.type : spec.locked?.includes(patch.key) ? "ADMIN_ERR_LOCKED" : null;
		if (patch.action === "import") {
			if (spec.kind !== "records") return ERR.type;
			let pattern = new RegExp(spec.keyPattern ?? DEFAULT_KEY);
			for (let [key, value] of Object.entries(patch.records)) {
				if (!pattern.test(key)) return ERR.pattern;
				let record = imported(spec, value);
				for (let [name, section] of Object.entries(spec.sections)) {
					let refusal = validate(section, record[name], name);
					if (refusal) return refusal.error;
					let link = this.linked(section, record[name]);
					if (link) return link;
				}
				let ruled = this.rules.get(patch.file)?.(key, record);
				if (ruled) return ruled;
			}
			return null;
		}
		let section = spec.sections[patch.section];
		if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
		let refusal = validate(section, patch.value, patch.section);
		if (refusal) return refusal.error;
		let link = this.linked(section, patch.value);
		if (link) return link;
		let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
			...isRecord(current) ? current : {},
			[patch.section]: patch.value
		};
		return this.rules.get(patch.file)?.(patch.key, next) ?? null;
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {};
		if (patch.action === "create") {
			let record = clone(spec.newRecord ?? {});
			spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
		} else if (patch.action === "delete") delete data[patch.key];
		else if (patch.action === "import") {
			for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
			this.data.set(patch.file, data);
			for (let key of Object.keys(patch.records)) this.changed(patch.file, key);
			return;
		} else {
			let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
			if (!isRecord(target)) return;
			patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
		}
		this.data.set(patch.file, data), this.changed(patch.file, spec.kind === "records" ? patch.key : void 0);
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$7.AdminPanelChanged({
			resource: this.resource,
			file,
			key,
			value: clone(value)
		}), spec?.sync !== "all") return;
		let changes = this.worldChanges.get(file) ?? {};
		changes[key ?? ""] = clone(value), this.worldChanges.set(file, changes), emitNet(ADMIN.worldEvent(this.resource), -1, file, key ?? null, value);
	}
	load(name, spec) {
		if (spec.memory) {
			this.data.set(name, {});
			return;
		}
		let file = new DataFile(this.resource, name, this.log);
		this.dataFiles.set(name, file), file.schemaRef = `./schemas/${name}.schema.json`, writeSchema(this.resource, name, fileSchema(this.resource, this.schema, name, spec), this.log);
		let raw = file.read(), data = isRecord(raw) ? raw : {}, filled = !1;
		if (spec.kind === "settings") for (let [section, value] of Object.entries(spec.defaults ?? {})) section in data || (data[section] = clone(value), filled = !0);
		this.data.set(name, data), (filled || raw === null || !file.hasSchemaRef()) && file.write(data);
	}
};
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
function aiLogChannels(channels) {
	optionalExport("ai-core")?.LogChannels(channels);
}
// ../../../packages/lib/src/server/notify.ts
function notify(source, text, kind = "info", duration) {
	let notification = {
		text,
		kind,
		duration
	};
	emitNet(CORE.clientNotifyEvent, source, notification);
}
resourceExport(CORE.resource);
// ../../../packages/lib/src/server/online.ts
const core$5 = resourceExport(CORE.resource);
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.put(source, character, (core$5.GetJobs(source) ?? []).map((m) => m.job), (core$5.GetGangs(source) ?? []).map((m) => m.gang)), this.setDuty(source, core$5.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => {
			let player = this.players.get(source);
			player && (player.jobs = jobs.map((m) => m.job));
		}), on(CORE.gangsChangedEvent, (source, gangs) => {
			let player = this.players.get(source);
			player && (player.gangs = gangs.map((m) => m.gang));
		}), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$5.GetLoadedSources()) {
			let character = core$5.GetCharacter(source);
			character && load(source, character);
		}
	}
	put(source, character, jobs, gangs) {
		this.drop(source), this.players.set(source, {
			character,
			jobs,
			gangs,
			duty: null
		});
	}
	drop(source) {
		this.setDuty(source, null), this.players.delete(source);
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player || (player.duty && this.onDuty.get(player.duty)?.delete(source), player.duty = job, !job)) return;
		let set = this.onDuty.get(job);
		set || this.onDuty.set(job, set = new Set()), set.add(source);
	}
	sources() {
		return this.start(), this.players.keys();
	}
	get size() {
		return this.start(), this.players.size;
	}
	character(source) {
		return this.start(), this.players.get(source)?.character ?? null;
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobs ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangs ?? [];
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set(), online = new OnlinePlayers();
resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/command.ts
const resource = GetCurrentResourceName(), log$5 = createLogger(resource);
let texts = null;
const t = (key, ...args) => formatText((texts ??= loadLocaleTexts(CORE.resource))[key] ?? key, args);
function reply(source, text, kind) {
	source > 0 ? notify(source, text, kind) : log$5.info(text);
}
var Command = class {
	params;
	handler;
	info;
	usage;
	constructor(names, params, help, aces, handler) {
		this.params = params, this.handler = handler, this.info = {
			names,
			help,
			params: params.map((p) => ({ ...p })),
			aces
		}, this.usage = [`/${names[0]}`, ...params.map((p) => p.optional ? `[${p.name}]` : `<${p.name}>`)].join(" ");
	}
	allowed(source, name) {
		let aces = this.info.aces;
		if (source <= 0 || !aces) return !0;
		let player = String(source);
		return aces.some((ace) => IsPlayerAceAllowed(player, ace)) || !!IsPlayerAceAllowed(player, `command.${name}`);
	}
	suggestion(name) {
		return {
			name: `/${name}`,
			help: this.info.help,
			params: this.params.map((p) => ({
				name: p.name,
				help: p.help ?? ""
			}))
		};
	}
	run(source, name, raw, line) {
		if (!this.allowed(source, name)) return reply(source, t("COMMAND_NOT_ALLOWED"), "error");
		let args = this.parse(raw);
		if (typeof args == "string") return reply(source, args, "error"), reply(source, t("COMMAND_USAGE", this.usage), "info");
		let fail = (error) => log$5.error(`command /${name} failed`, error);
		try {
			let result = this.handler(source, args, line);
			result instanceof Promise && result.catch(fail);
		} catch (error) {
			fail(error);
		}
	}
	parse(raw) {
		let args = {};
		for (let [i, param] of this.params.entries()) {
			let token = param.type === "longString" ? raw.slice(i).join(" ").trim() : raw[i] ?? "";
			if (token === "") {
				if (!param.optional) return t("COMMAND_MISSING", param.name);
			} else {
				if (param.type === "number" || param.type === "playerId") {
					let value = Number(token);
					if (!Number.isFinite(value)) return t("COMMAND_NUMBER", param.name);
					if (param.type === "playerId" && (!Number.isInteger(value) || value <= 0 || !GetPlayerName(String(value)))) return t("COMMAND_PLAYER", token);
					args[param.name] = value;
				} else args[param.name] = token;
				if (param.type === "longString") break;
			}
		}
		return args;
	}
};
const commands = new class {
	list = [];
	sent = new Map();
	announced = 0;
	queued = !1;
	listening = !1;
	add(command) {
		this.listening || this.listen(), this.list.push(command), this.queued || (this.queued = !0, setImmediate(() => this.flush()));
	}
	refresh(source) {
		let before = this.sent.get(source), now = new Set(), add = [];
		for (let command of this.list) for (let name of command.info.names) command.allowed(source, name) && (now.add(name), before?.has(name) || add.push(command.suggestion(name)));
		if (this.sent.set(source, now), add.length && emitNet("chat:addSuggestions", source, add), before) for (let name of before) now.has(name) || emitNet("chat:removeSuggestion", source, `/${name}`);
	}
	flush() {
		this.queued = !1, optionalExport(CORE.resource)?.RegisterCommands(resource, this.list.slice(this.announced).map((c) => c.info)), this.announced = this.list.length;
		for (let player of getPlayers()) this.refresh(Number(player));
	}
	listen() {
		this.listening = !0;
		let refresh = (source) => this.refresh(Number(source));
		on(CORE.playerLoadedEvent, refresh), on(CORE.jobsChangedEvent, refresh), on(CORE.gangsChangedEvent, refresh), on("playerDropped", () => this.sent.delete(Number(globalThis.source))), on("onResourceStop", (name) => {
			if (name === resource) for (let command of this.list) for (let n of command.info.names) emitNet("chat:removeSuggestion", -1, `/${n}`);
		});
	}
}();
function addCommand(name, options, handler) {
	let names = (Array.isArray(name) ? name : [name]).map((n) => n.toLowerCase());
	if (names.length === 0) throw Error("addCommand needs a name");
	let restricted = options.restricted ?? !1, aces = restricted === !1 ? null : restricted === !0 ? [ADMIN.ace] : Array.isArray(restricted) ? [...restricted] : [restricted], command = new Command(names, options.params ?? [], options.help ?? "", aces, handler);
	for (let n of names) RegisterCommand(n, (source, raw, line) => command.run(Number(source), n, raw, line), !1);
	commands.add(command);
}
// ../../../packages/lib/src/server/netEvent.ts
const log$4 = createLogger(GetCurrentResourceName());
function onClientEvent(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 10);
	onNet(name, (...raw) => {
		let source = Number(globalThis.source), args = gate.check(source, raw);
		args && gate.run(source, void 0, () => handler(source, ...args)).catch((error) => log$4.error(`event ${name} failed for ${source}`, error));
	});
}
createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/state.ts
const stateNumber = (v) => typeof v == "number" && Number.isFinite(v) ? v : void 0, stateBoolean = (v) => typeof v == "boolean" ? v : void 0, isServer = IsDuplicityVersion();
var Mirror = class {
	key;
	parse;
	values = new Map();
	listeners = new Set();
	constructor(key, parse) {
		this.key = key, this.parse = parse;
	}
	onChange(listener) {
		return this.listeners.add(listener), () => this.listeners.delete(listener);
	}
	store(id, raw) {
		this.apply(id, raw == null ? void 0 : this.parse(raw));
	}
	apply(id, value) {
		let old = this.values.get(id);
		if (this.values.set(id, value), old !== value) for (let listener of this.listeners) listener(id, value, old);
	}
}, PlayerState$1 = class extends Mirror {
	seen = new Set();
	constructor(key, parse) {
		super(key, parse), AddStateBagChangeHandler(key, "", (bag, _key, value) => {
			if (!bag.startsWith("player:")) return;
			let id = Number(bag.slice(7));
			this.seen.add(id), this.store(id, value);
		}), isServer && on("playerDropped", () => this.forget(Number(globalThis.source)));
	}
	get(serverId) {
		if (!this.seen.has(serverId)) {
			this.seen.add(serverId);
			let raw = Player(serverId).state[this.key];
			this.values.set(serverId, raw == null ? void 0 : this.parse(raw));
		}
		return this.values.get(serverId);
	}
	put(serverId, value) {
		this.seen.add(serverId), this.apply(serverId, value);
	}
	forget(serverId) {
		this.values.delete(serverId), this.seen.delete(serverId);
	}
}, GlobalKey$1 = class extends Mirror {
	constructor(key, parse) {
		super(key, parse);
		let raw = GlobalState[key];
		this.values.set("global", raw == null ? void 0 : parse(raw)), AddStateBagChangeHandler(key, "global", (_bag, _key, value) => this.store("global", value));
	}
	get() {
		return this.values.get("global");
	}
	put(value) {
		this.apply("global", value);
	}
}, PlayerState = class extends PlayerState$1 {
	set(source, value) {
		Player(source).state.set(this.key, value ?? null, !0), this.put(source, value);
	}
}, GlobalKey = class extends GlobalKey$1 {
	set(value) {
		GlobalState.set(this.key, value ?? null, !0), this.put(value);
	}
};
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/index.ts
function eventSource() {
	return Number(globalThis.source);
}
// resource/common/locale.ts
const Locale = createLocale(), ResourceName = GetCurrentResourceName();
IsDuplicityVersion();
// resource/common/voice.ts
const EVENTS = {
	setMode: "ai-voice:setMode",
	setRange: "ai-voice:setRange"
}, PMA = {
	setPlayerRadio: "pma-voice:setPlayerRadio",
	setTalkingOnRadio: "pma-voice:setTalkingOnRadio",
	setPlayerCall: "pma-voice:setPlayerCall",
	syncRadioData: "pma-voice:syncRadioData",
	addPlayerToRadio: "pma-voice:addPlayerToRadio",
	removePlayerFromRadio: "pma-voice:removePlayerFromRadio",
	clSetPlayerRadio: "pma-voice:clSetPlayerRadio",
	syncCallData: "pma-voice:syncCallData",
	addPlayerToCall: "pma-voice:addPlayerToCall",
	removePlayerFromCall: "pma-voice:removePlayerFromCall",
	clSetPlayerCall: "pma-voice:clSetPlayerCall",
	setTalkingMode: "pma-voice:setTalkingMode",
	radioActive: "pma-voice:radioActive",
	toggleRadioAnim: "pma-voice:toggleRadioAnim",
	settingsCallback: "pma-voice:settingsCallback",
	playerMuted: "pma-voice:playerMuted"
}, KEYS = {
	backend: "ai-voice:backend",
	proximity: "proximity",
	radioChannel: "radioChannel",
	callChannel: "callChannel",
	muted: "muted",
	isDead: "isDead"
}, parseBackend = (v) => v === "mumble" || v === "enhanced" ? v : void 0, parseProximity = (v) => isRecord(v) && typeof v.index == "number" && typeof v.distance == "number" && typeof v.mode == "string" ? {
	index: v.index,
	distance: v.distance,
	mode: v.mode
} : void 0, RANGE_MIN = .5, CHANNEL_MAX = 1e6, isChannel = (v) => typeof v == "number" && Number.isFinite(v) && v >= 0 && v <= 1e6, toChannel = (v) => {
	let n = typeof v == "string" ? Number(v) : v;
	return isChannel(n) ? n : null;
}, DEFAULT_MODES = [
	{
		label: "Whisper",
		distance: 1.5
	},
	{
		label: "Normal",
		distance: 3
	},
	{
		label: "Shouting",
		distance: 6
	}
];
function readModes(value) {
	if (!Array.isArray(value)) return DEFAULT_MODES;
	let modes = [];
	for (let row of value) {
		if (!isRecord(row)) continue;
		let distance = num(row.distance, 0, RANGE_MIN, 100);
		distance > 0 && modes.push({
			label: str(row.label, `${distance} m`, 24),
			distance
		});
	}
	return modes.length ? modes : DEFAULT_MODES;
}
function readSettings(raw) {
	let modes = readModes(raw.modes), backend = raw.backend;
	return {
		backend: backend === "enhanced" || backend === "mumble" ? backend : "auto",
		modes,
		defaultMode: int(raw.defaultMode, 2, 1, modes.length),
		cycle: bool(raw.cycle, !0),
		radio: bool(raw.radio, !0),
		radioVolume: int(raw.radioVolume, 30, 0, 100),
		radioAnim: bool(raw.radioAnim, !1),
		radioAnimInVehicle: bool(raw.radioAnimInVehicle, !0),
		radioSubmix: bool(raw.radioSubmix, !0),
		micClicks: bool(raw.micClicks, !0),
		syncNames: bool(raw.syncNames, !1),
		phone: bool(raw.phone, !0),
		phoneVolume: int(raw.phoneVolume, 60, 0, 100),
		phoneSubmix: bool(raw.phoneSubmix, !0)
	};
}
function proximityOf(settings, index) {
	let mode = settings.modes[index - 1] ?? settings.modes[0] ?? DEFAULT_MODES[1];
	return {
		index,
		distance: mode?.distance ?? 3,
		mode: mode?.label ?? "Normal"
	};
}
// resource/server/schema.ts
const volume = {
	type: "number",
	min: 0,
	max: 100,
	integer: !0
}, panel = new AdminPanel({
	title: "ADMIN_TITLE",
	icon: "microphone",
	files: {
		settings: {
			kind: "settings",
			sync: "all",
			sections: {
				backend: {
					type: "enum",
					values: [
						"auto",
						"enhanced",
						"mumble"
					]
				},
				modes: {
					type: "list",
					min: 1,
					max: 6,
					of: {
						type: "object",
						fields: {
							label: {
								type: "text",
								min: 1,
								max: 24
							},
							distance: {
								type: "number",
								min: RANGE_MIN,
								max: 100
							}
						}
					}
				},
				defaultMode: {
					type: "number",
					min: 1,
					max: 6,
					integer: !0
				},
				cycle: { type: "bool" },
				radio: { type: "bool" },
				radioVolume: volume,
				radioAnim: { type: "bool" },
				radioAnimInVehicle: { type: "bool" },
				radioSubmix: { type: "bool" },
				micClicks: { type: "bool" },
				syncNames: { type: "bool" },
				phone: { type: "bool" },
				phoneVolume: volume,
				phoneSubmix: { type: "bool" }
			},
			defaults: {
				backend: "auto",
				modes: DEFAULT_MODES,
				defaultMode: 2,
				cycle: !0,
				radio: !0,
				radioVolume: 30,
				radioAnim: !1,
				radioAnimInVehicle: !0,
				radioSubmix: !0,
				micClicks: !0,
				syncNames: !1,
				phone: !0,
				phoneVolume: 60,
				phoneSubmix: !0
			}
		},
		channels: {
			kind: "records",
			sync: "admin",
			labelPath: "label",
			newRecord: {
				from: 1,
				to: 10,
				jobs: ["police"],
				onDuty: !0
			},
			sections: {
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				from: {
					type: "number",
					min: .01,
					max: CHANNEL_MAX
				},
				to: {
					type: "number",
					min: .01,
					max: CHANNEL_MAX
				},
				jobs: {
					type: "names",
					max: 20,
					itemMax: 32,
					lookup: "job"
				},
				onDuty: { type: "bool" }
			}
		}
	},
	tabs: [{
		id: "settings",
		file: "settings",
		icon: "sliders",
		label: "ADMIN_TAB_SETTINGS",
		desc: "ADMIN_TAB_SETTINGS_DESC",
		cards: [
			{
				icon: "server",
				title: "ADMIN_C_BACKEND",
				desc: "ADMIN_C_BACKEND_DESC",
				fields: [{
					widget: "select",
					path: "backend",
					label: "ADMIN_F_BACKEND",
					hint: "ADMIN_H_BACKEND",
					options: [
						{
							value: "auto",
							label: "ADMIN_O_AUTO"
						},
						{
							value: "enhanced",
							label: "ADMIN_O_ENHANCED"
						},
						{
							value: "mumble",
							label: "ADMIN_O_MUMBLE"
						}
					]
				}]
			},
			{
				icon: "microphone",
				title: "ADMIN_C_RANGES",
				desc: "ADMIN_C_RANGES_DESC",
				fields: [
					{
						widget: "list",
						path: "modes",
						label: "ADMIN_F_MODES",
						addLabel: "ADMIN_ADD_MODE",
						rowLabel: "ADMIN_ROW_MODE",
						max: 6,
						newRow: {
							label: "Far",
							distance: 10
						},
						rows: [{
							widget: "text",
							path: "label",
							label: "ADMIN_F_MODE_LABEL",
							placeholder: "ADMIN_P_MODE_LABEL"
						}, {
							widget: "number",
							path: "distance",
							label: "ADMIN_F_MODE_DISTANCE",
							hint: "ADMIN_H_MODE_DISTANCE",
							min: RANGE_MIN,
							max: 100,
							step: .5,
							unit: "m"
						}]
					},
					{
						widget: "number",
						path: "defaultMode",
						label: "ADMIN_F_DEFAULT_MODE",
						hint: "ADMIN_H_DEFAULT_MODE",
						min: 1,
						max: 6
					},
					{
						widget: "switch",
						path: "cycle",
						label: "ADMIN_F_CYCLE",
						hint: "ADMIN_H_CYCLE"
					}
				]
			},
			{
				icon: "comments",
				title: "ADMIN_C_RADIO",
				desc: "ADMIN_C_RADIO_DESC",
				fields: [
					{
						widget: "switch",
						path: "radio",
						label: "ADMIN_F_RADIO"
					},
					{
						widget: "number",
						path: "radioVolume",
						label: "ADMIN_F_RADIO_VOLUME",
						hint: "ADMIN_H_VOLUME",
						min: 0,
						max: 100,
						unit: "%"
					},
					{
						widget: "switch",
						path: "radioSubmix",
						label: "ADMIN_F_RADIO_SUBMIX",
						hint: "ADMIN_H_SUBMIX"
					},
					{
						widget: "switch",
						path: "micClicks",
						label: "ADMIN_F_MIC_CLICKS",
						hint: "ADMIN_H_MIC_CLICKS"
					},
					{
						widget: "switch",
						path: "radioAnim",
						label: "ADMIN_F_RADIO_ANIM",
						hint: "ADMIN_H_RADIO_ANIM"
					},
					{
						widget: "switch",
						path: "radioAnimInVehicle",
						label: "ADMIN_F_RADIO_ANIM_VEHICLE"
					},
					{
						widget: "switch",
						path: "syncNames",
						label: "ADMIN_F_SYNC_NAMES",
						hint: "ADMIN_H_SYNC_NAMES"
					}
				]
			},
			{
				icon: "comments",
				title: "ADMIN_C_PHONE",
				desc: "ADMIN_C_PHONE_DESC",
				fields: [
					{
						widget: "switch",
						path: "phone",
						label: "ADMIN_F_PHONE"
					},
					{
						widget: "number",
						path: "phoneVolume",
						label: "ADMIN_F_PHONE_VOLUME",
						hint: "ADMIN_H_VOLUME",
						min: 0,
						max: 100,
						unit: "%"
					},
					{
						widget: "switch",
						path: "phoneSubmix",
						label: "ADMIN_F_PHONE_SUBMIX",
						hint: "ADMIN_H_SUBMIX"
					}
				]
			}
		]
	}, {
		id: "channels",
		file: "channels",
		icon: "lock",
		label: "ADMIN_TAB_CHANNELS",
		desc: "ADMIN_TAB_CHANNELS_DESC",
		listSub: "jobs",
		createLabel: "ADMIN_NEW_CHANNEL",
		deleteLabel: "ADMIN_DELETE_CHANNEL",
		cards: [{
			icon: "lock",
			title: "ADMIN_C_CHANNEL",
			desc: "ADMIN_C_CHANNEL_DESC",
			fields: [
				{
					widget: "text",
					path: "label",
					label: "ADMIN_F_CHANNEL_NAME",
					placeholder: "ADMIN_P_CHANNEL_NAME"
				},
				{
					widget: "number",
					path: "from",
					label: "ADMIN_F_CHANNEL_FROM",
					hint: "ADMIN_H_CHANNEL_RANGE",
					min: .01,
					max: CHANNEL_MAX,
					step: .01
				},
				{
					widget: "number",
					path: "to",
					label: "ADMIN_F_CHANNEL_TO",
					hint: "ADMIN_H_CHANNEL_RANGE",
					min: .01,
					max: CHANNEL_MAX,
					step: .01
				},
				{
					widget: "tags",
					path: "jobs",
					label: "ADMIN_F_CHANNEL_JOBS",
					hint: "ADMIN_H_CHANNEL_JOBS",
					placeholder: "ADMIN_P_CHANNEL_JOBS",
					lookup: "job"
				},
				{
					widget: "switch",
					path: "onDuty",
					label: "ADMIN_F_CHANNEL_DUTY",
					hint: "ADMIN_H_CHANNEL_DUTY"
				}
			]
		}]
	}]
});
panel.rule("channels", (_key, next) => isRecord(next) && num(next.from, 0) > num(next.to, 0) ? "ADMIN_ERR_CHANNEL_RANGE" : null);
function readRestrictions(raw) {
	let list = [];
	for (let value of Object.values(raw)) isRecord(value) && list.push({
		label: str(value.label, "", 48),
		from: num(value.from, 0),
		to: num(value.to, 0),
		jobs: Array.isArray(value.jobs) ? value.jobs.filter((j) => typeof j == "string") : [],
		onDuty: bool(value.onDuty, !0)
	});
	return list;
}
const content = new class {
	settings = readSettings(panel.get("settings"));
	restrictions = readRestrictions(panel.get("channels"));
	listeners = [];
	constructor() {
		panel.onChange("settings", () => {
			let old = this.settings;
			this.settings = readSettings(panel.get("settings"));
			for (let listener of this.listeners) listener(this.settings, old);
		}), panel.onChange("channels", () => {
			this.restrictions = readRestrictions(panel.get("channels"));
		});
	}
	onSettings(listener) {
		this.listeners.push(listener);
	}
	restrictionOf(channel) {
		return this.restrictions.find((r) => channel >= r.from && channel <= r.to);
	}
}(), HASH = {
	create: "0x7A70A736",
	remove: "0x0D3A0512",
	add: "0xEA8CA2F5",
	leave: "0xDB325A2D",
	mute: "0x2A1DEA36",
	deaf: "0x3469B8AC"
}, float = (value) => value === 0 ? value : value + 1e-7, voiceNatives = {
	create: (mode, maxDistance) => Citizen.invokeNative(HASH.create, mode, float(maxDistance), Citizen.resultAsInteger()),
	remove: (channel) => Citizen.invokeNative(HASH.remove, channel),
	add: (channel, source) => Citizen.invokeNative(HASH.add, channel, source),
	leave: (channel, source) => Citizen.invokeNative(HASH.leave, channel, source),
	mute: (channel, source, muted) => Citizen.invokeNative(HASH.mute, channel, source, muted),
	deaf: (channel, source, deaf) => Citizen.invokeNative(HASH.deaf, channel, source, deaf)
};
function hasEnhancedVoice() {
	try {
		let a = voiceNatives.create(0, 0), b = voiceNatives.create(0, 0), ok = typeof a == "number" && typeof b == "number" && a !== b && a < 65535 && b < 65535;
		return ok && (voiceNatives.remove(a), voiceNatives.remove(b)), ok;
	} catch {
		return !1;
	}
}
// resource/server/channel.ts
var VoiceChannel = class VoiceChannel {
	id;
	label;
	members = new Map();
	constructor(id, label) {
		this.id = id, this.label = label;
	}
	static spatial(maxDistance, label) {
		return VoiceChannel.create(1, maxDistance, label);
	}
	static flat(label) {
		return VoiceChannel.create(0, 0, label);
	}
	static create(mode, distance, label) {
		let id = voiceNatives.create(mode, distance);
		return id >= 65535 ? null : new VoiceChannel(id, label);
	}
	get size() {
		return this.members.size;
	}
	has(source) {
		return this.members.has(source);
	}
	add(source, muted) {
		if (this.members.get(source)) return this.setMuted(source, muted);
		voiceNatives.add(this.id, source), this.members.set(source, { muted: !1 }), muted && this.setMuted(source, !0);
	}
	remove(source) {
		this.members.delete(source) && voiceNatives.leave(this.id, source);
	}
	setMuted(source, muted) {
		let member = this.members.get(source);
		member && member.muted !== muted && (voiceNatives.mute(this.id, source, muted), member.muted = muted);
	}
	forget(source) {
		this.members.delete(source);
	}
	destroy() {
		this.members.clear(), voiceNatives.remove(this.id);
	}
	describe() {
		let list = [...this.members].map(([s, m]) => `${s}${m.muted ? "m" : ""}`).join(",");
		return `${this.label}#${this.id} [${list}]`;
	}
};
// resource/server/enhanced.ts
const log$2 = createLogger(ResourceName);
var Bucket = class {
	channels = new Map();
	talkers = new Map();
}, EnhancedRouter = class {
	modeDistances;
	backend = "enhanced";
	buckets = new Map();
	bucketOf = new Map();
	radios = new Map();
	calls = new Map();
	timer;
	constructor(modeDistances) {
		this.modeDistances = modeDistances, this.timer = setInterval(() => this.watchBuckets(), 1e3);
	}
	join(talker) {
		let bucketId = GetPlayerRoutingBucket(String(talker.source));
		this.bucketOf.set(talker.source, bucketId);
		let bucket = this.bucket(bucketId);
		bucket.talkers.set(talker.source, talker), this.channel(bucket, talker.distance);
		for (let [distance, channel] of bucket.channels) channel.add(talker.source, talker.muted || distance !== talker.distance);
	}
	forget(source) {
		let bucketId = this.bucketOf.get(source);
		this.bucketOf.delete(source);
		for (let channel of this.radios.values()) channel.forget(source);
		for (let channel of this.calls.values()) channel.forget(source);
		if (bucketId === void 0) return;
		let bucket = this.buckets.get(bucketId);
		if (bucket) {
			bucket.talkers.delete(source);
			for (let channel of bucket.channels.values()) channel.forget(source);
			this.prune(bucketId, bucket);
		}
	}
	update(talker) {
		let bucketId = this.bucketOf.get(talker.source), bucket = bucketId === void 0 ? null : this.buckets.get(bucketId);
		if (bucketId === void 0 || !bucket) return this.join(talker);
		bucket.talkers.set(talker.source, talker), this.channel(bucket, talker.distance);
		for (let [distance, channel] of bucket.channels) channel.setMuted(talker.source, talker.muted || distance !== talker.distance);
		for (let channel of this.calls.values()) channel.setMuted(talker.source, talker.muted);
		if (talker.muted) for (let channel of this.radios.values()) channel.setMuted(talker.source, !0);
		this.prune(bucketId, bucket);
	}
	radioJoin(source, channel) {
		this.group(this.radios, channel, "radio")?.add(source, !0);
	}
	radioLeave(source, channel) {
		this.leaveGroup(this.radios, channel, source);
	}
	radioTalk(source, channel, talking) {
		let muted = this.bucketTalker(source)?.muted ?? !1;
		this.radios.get(channel)?.setMuted(source, muted || !talking);
	}
	callJoin(source, channel) {
		let muted = this.bucketTalker(source)?.muted ?? !1;
		this.group(this.calls, channel, "call")?.add(source, muted);
	}
	callLeave(source, channel) {
		this.leaveGroup(this.calls, channel, source);
	}
	rebuild(talkers) {
		for (let bucket of this.buckets.values()) for (let channel of bucket.channels.values()) channel.destroy();
		this.buckets.clear(), this.bucketOf.clear();
		for (let talker of talkers) this.join(talker);
	}
	stop() {
		clearInterval(this.timer);
		for (let bucket of this.buckets.values()) for (let channel of bucket.channels.values()) channel.destroy();
		for (let channel of this.radios.values()) channel.destroy();
		for (let channel of this.calls.values()) channel.destroy();
		this.buckets.clear(), this.radios.clear(), this.calls.clear();
	}
	describe() {
		let lines = [];
		for (let [id, bucket] of this.buckets) for (let channel of bucket.channels.values()) lines.push(`bucket ${id}: ${channel.describe()}`);
		for (let channel of this.radios.values()) lines.push(channel.describe());
		for (let channel of this.calls.values()) lines.push(channel.describe());
		return lines;
	}
	bucket(id) {
		let bucket = this.buckets.get(id);
		return bucket || this.buckets.set(id, bucket = new Bucket()), bucket;
	}
	bucketTalker(source) {
		let id = this.bucketOf.get(source);
		return id === void 0 ? void 0 : this.buckets.get(id)?.talkers.get(source);
	}
	channel(bucket, distance) {
		if (bucket.channels.has(distance)) return;
		let channel = VoiceChannel.spatial(distance, `proximity ${distance}m`);
		if (!channel) return log$2.error("voice channel limit reached");
		bucket.channels.set(distance, channel);
		for (let talker of bucket.talkers.values()) channel.add(talker.source, talker.muted || talker.distance !== distance);
	}
	prune(id, bucket) {
		if (bucket.talkers.size === 0) {
			for (let channel of bucket.channels.values()) channel.destroy();
			this.buckets.delete(id);
			return;
		}
		let keep = new Set(this.modeDistances());
		for (let talker of bucket.talkers.values()) keep.add(talker.distance);
		for (let [distance, channel] of bucket.channels) keep.has(distance) || (channel.destroy(), bucket.channels.delete(distance));
	}
	group(map, id, kind) {
		let channel = map.get(id) ?? null;
		return channel || (channel = VoiceChannel.flat(`${kind} ${id}`), channel ? (map.set(id, channel), channel) : (log$2.error("voice channel limit reached"), null));
	}
	leaveGroup(map, id, source) {
		let channel = map.get(id);
		channel && (channel.remove(source), channel.size > 0 || (channel.destroy(), map.delete(id)));
	}
	watchBuckets() {
		for (let [source, id] of this.bucketOf) {
			if (GetPlayerRoutingBucket(String(source)) === id) continue;
			let talker = this.bucketTalker(source), old = this.buckets.get(id);
			if (old && talker) {
				old.talkers.delete(source);
				for (let channel of old.channels.values()) channel.remove(source);
				this.prune(id, old);
			}
			talker && this.join(talker);
		}
	}
};
// resource/server/checks.ts
const log$1 = createLogger(ResourceName);
var Registered = class {
	entries = new Map();
	set(key, fn, resource) {
		return typeof fn == "function" && (this.entries.set(key, {
			resource,
			fn
		}), !0);
	}
	get(key) {
		return this.entries.get(key)?.fn;
	}
	values() {
		return [...this.entries.values()].map((e) => e.fn);
	}
	dropResource(resource) {
		for (let [key, entry] of this.entries) entry.resource === resource && this.entries.delete(key);
	}
};
function ask(fn, ...args) {
	try {
		return fn(...args);
	} catch (error) {
		return log$1.error("a voice check from another resource failed", error), !1;
	}
}
const checks = new class {
	radio = new Registered();
	modes = new Registered();
	names = new Registered();
	constructor() {
		on("onResourceStop", (resource) => {
			this.radio.dropResource(resource), this.modes.dropResource(resource), this.names.dropResource(resource);
		});
	}
	addRadioCheck(channel, fn, resource) {
		return this.radio.set(channel, fn, resource);
	}
	addModeCheck(fn, resource) {
		return this.modes.set(resource, fn, resource);
	}
	setNameGetter(fn, resource) {
		return this.names.set("name", fn, resource);
	}
	canJoinRadio(source, channel) {
		let rule = content.restrictionOf(channel);
		if (rule && rule.jobs.length) {
			let duty = online.dutyJob(source);
			if (!(rule.onDuty ? duty !== null && rule.jobs.includes(duty) : online.jobs(source).some((job) => rule.jobs.includes(job)))) return !1;
		}
		let fn = this.radio.get(channel);
		return !fn || !!ask(fn, source);
	}
	canSetRange(source, index, distance) {
		return this.modes.values().every((fn) => ask(fn, source, index, distance) !== !1);
	}
	radioName(source) {
		let fn = this.names.get("name"), custom = fn ? ask(fn, source) : null;
		if (typeof custom == "string") return custom;
		let character = online.character(source);
		return character ? `${character.firstname} ${character.lastname}` : GetPlayerName(String(source));
	}
}();
// resource/server/exports.ts
function both(name, fn) {
	registerExport(name, fn), provideExport("pma-voice", name, fn);
}
const toSource = (v) => {
	let n = typeof v == "string" ? Number(v) : v;
	return typeof n == "number" && Number.isInteger(n) && n > 0 ? n : null;
}, invoker = () => GetInvokingResource() ?? "unknown";
function channelArg(value, what) {
	let channel = toChannel(value);
	if (channel === null) throw Error(`'${what}' expected a number`);
	return channel;
}
function registerServerExports(players, groups, mutes, router) {
	both("setPlayerRadio", (source, channel) => {
		let src = toSource(source);
		src && groups.setRadio(src, channelArg(channel, "radioChannel"), !0);
	}), both("setPlayerCall", (source, channel) => {
		let src = toSource(source);
		src && groups.setCall(src, channelArg(channel, "callChannel"), !0);
	});
	let members = (channel) => {
		let id = toChannel(channel);
		return id === null ? {} : groups.radioMembers(id);
	};
	both("getPlayersInRadioChannel", members), both("GetPlayersInRadioChannel", members), both("addChannelCheck", (channel, fn) => {
		if (!checks.addRadioCheck(channelArg(channel, "channel"), fn, invoker())) throw Error("'cb' expected a function");
	}), both("overrideRadioNameGetter", (_channel, fn) => {
		if (!checks.setNameGetter(fn, invoker())) throw Error("'cb' expected a function");
	}), both("isValidPlayer", (source) => {
		let src = toSource(source);
		return src !== null && players.get(src) !== void 0;
	}), registerExport("getBackend", () => router.backend), registerExport("setPlayerProximityMode", (source, index) => {
		let src = toSource(source);
		return src !== null && typeof index == "number" && players.setMode(src, index);
	}), registerExport("setPlayerRange", (source, range) => {
		let src = toSource(source);
		return src === null ? !1 : range == null ? players.setRange(src, null) : typeof range == "number" && range >= .5 && range <= 100 && players.setRange(src, range);
	}), registerExport("getPlayerProximity", (source) => {
		let src = toSource(source);
		return src !== null && players.get(src)?.proximity() || null;
	}), registerExport("toggleMute", (source, seconds) => {
		let src = toSource(source), time = typeof seconds == "number" && seconds > 0 ? seconds : 900;
		return src !== null && mutes.toggle(src, 0, time);
	}), registerExport("addProximityCheck", (fn) => {
		if (!checks.addModeCheck(fn, invoker())) throw Error("expected a function");
	});
}
// resource/server/players.ts
const proximityBag = new PlayerState(KEYS.proximity, parseProximity), radioBag = new PlayerState(KEYS.radioChannel, stateNumber), callBag = new PlayerState(KEYS.callChannel, stateNumber), mutedBag = new PlayerState(KEYS.muted, stateBoolean);
var VoicePlayer = class {
	source;
	mode;
	range = null;
	radio = 0;
	call = 0;
	muted = !1;
	constructor(source) {
		this.source = source, this.mode = content.settings.defaultMode;
	}
	get distance() {
		return this.range ?? proximityOf(content.settings, this.mode).distance;
	}
	proximity() {
		let base = proximityOf(content.settings, this.mode);
		return this.range === null ? base : {
			index: this.mode,
			distance: this.range,
			mode: "Custom"
		};
	}
}, Players = class {
	router;
	players = new Map();
	constructor(router) {
		this.router = router;
	}
	get(source) {
		return this.players.get(source);
	}
	all() {
		return this.players.values();
	}
	join(source) {
		let existing = this.players.get(source);
		if (existing) return existing;
		let player = new VoicePlayer(source);
		return this.players.set(source, player), proximityBag.set(source, player.proximity()), radioBag.set(source, 0), callBag.set(source, 0), mutedBag.set(source, !1), this.router.join(player), player;
	}
	drop(source) {
		this.players.delete(source), this.router.forget(source);
	}
	setMode(source, index) {
		let player = this.players.get(source);
		if (!player || index < 1 || index > content.settings.modes.length) return !1;
		let distance = proximityOf(content.settings, index).distance;
		return checks.canSetRange(source, index, distance) ? (player.mode = index, player.range = null, this.apply(player), !0) : !1;
	}
	setRange(source, range) {
		let player = this.players.get(source);
		return !player || range !== null && !checks.canSetRange(source, player.mode, range) ? !1 : (player.range = range, this.apply(player), !0);
	}
	setMuted(source, muted) {
		let player = this.players.get(source);
		player && (player.muted = muted, mutedBag.set(source, muted), this.router.update(player));
	}
	reload() {
		let count = content.settings.modes.length;
		for (let player of this.players.values()) player.mode > count && (player.mode = content.settings.defaultMode), proximityBag.set(player.source, player.proximity());
		this.router.rebuild(this.players.values());
	}
	apply(player) {
		proximityBag.set(player.source, player.proximity()), this.router.update(player);
	}
};
// resource/server/groups.ts
const table = (members) => Object.fromEntries(members);
var Groups = class {
	players;
	router;
	radios = new Map();
	calls = new Map();
	constructor(players, router) {
		this.players = players, this.router = router;
	}
	setRadio(source, channel, fromScript) {
		let player = this.players.get(source);
		if (player && content.settings.radio && (fromScript && emitNet(PMA.clSetPlayerRadio, source, channel), player.radio !== channel)) {
			if (player.radio !== 0 && this.leaveRadio(source, player.radio), player.radio = 0, channel !== 0) {
				if (!checks.canJoinRadio(source, channel)) {
					emitNet(PMA.removePlayerFromRadio, source, source), radioBag.set(source, 0);
					return;
				}
				this.joinRadio(source, channel), player.radio = channel;
			}
			radioBag.set(source, player.radio);
		}
	}
	setRadioTalking(source, talking) {
		let channel = this.players.get(source)?.radio ?? 0, members = this.radios.get(channel);
		if (members?.has(source) && members.get(source) !== talking) {
			members.set(source, talking);
			for (let member of members.keys()) member !== source && emitNet(PMA.setTalkingOnRadio, member, source, talking);
			this.router.radioTalk(source, channel, talking);
		}
	}
	setCall(source, channel, fromScript) {
		let player = this.players.get(source);
		player && content.settings.phone && (fromScript && emitNet(PMA.clSetPlayerCall, source, channel), player.call !== channel && (player.call !== 0 && this.leaveCall(source, player.call), player.call = channel, channel !== 0 && this.joinCall(source, channel), callBag.set(source, channel)));
	}
	radioMembers(channel) {
		let members = this.radios.get(channel);
		return members ? table(members) : {};
	}
	drop(source) {
		let player = this.players.get(source);
		player && (player.radio !== 0 && this.leaveRadio(source, player.radio), player.call !== 0 && this.leaveCall(source, player.call));
	}
	describe() {
		let line = (kind, map) => [...map].map(([id, m]) => `${kind} ${id}: ${[...m.keys()].join(",")}`);
		return [...line("radio", this.radios), ...line("call", this.calls)];
	}
	joinRadio(source, channel) {
		let members = this.radios.get(channel);
		members || this.radios.set(channel, members = new Map());
		let name = content.settings.syncNames ? checks.radioName(source) : !1;
		for (let member of members.keys()) emitNet(PMA.addPlayerToRadio, member, source, name);
		members.set(source, !1), emitNet(PMA.syncRadioData, source, table(members), name), this.router.radioJoin(source, channel);
	}
	leaveRadio(source, channel) {
		let members = this.radios.get(channel);
		if (members) {
			for (let member of members.keys()) emitNet(PMA.removePlayerFromRadio, member, source);
			members.delete(source), members.size === 0 && this.radios.delete(channel), this.router.radioLeave(source, channel);
		}
	}
	joinCall(source, channel) {
		let members = this.calls.get(channel);
		members || this.calls.set(channel, members = new Map());
		for (let member of members.keys()) emitNet(PMA.addPlayerToCall, member, source);
		members.set(source, !1), emitNet(PMA.syncCallData, source, table(members)), this.router.callJoin(source, channel);
	}
	leaveCall(source, channel) {
		let members = this.calls.get(channel);
		if (members) {
			for (let member of members.keys()) emitNet(PMA.removePlayerFromCall, member, source);
			members.delete(source), members.size === 0 && this.calls.delete(channel), this.router.callLeave(source, channel);
		}
	}
}, Mutes = class {
	players;
	timers = new Map();
	constructor(players) {
		this.players = players;
	}
	toggle(target, by, seconds) {
		let player = this.players.get(target);
		if (!player) return !1;
		let muted = !player.muted;
		return this.clear(target), this.players.setMuted(target, muted), emit(PMA.playerMuted, target, by, muted, seconds), muted && this.timers.set(target, setTimeout(() => {
			this.timers.delete(target), this.players.setMuted(target, !1), emit(PMA.playerMuted, target, 0, !1, 0);
		}, seconds * 1e3)), notify(target, Locale(muted ? "NOTIFY_MUTED" : "NOTIFY_UNMUTED"), "info"), aiLog("mutes", muted ? "voice muted" : "voice unmuted", {
			source: by > 0 ? by : void 0,
			target,
			metadata: { seconds: muted ? seconds : 0 }
		}), !0;
	}
	clear(source) {
		let timer = this.timers.get(source);
		timer && clearTimeout(timer), this.timers.delete(source);
	}
}, MumbleRouter = class {
	backend = "mumble";
	muted = new Set();
	constructor() {
		SetConvarReplicated("voice_useNativeAudio", "true"), SetConvarReplicated("voice_useSendingRangeOnly", "true");
	}
	join(talker) {
		this.update(talker);
	}
	forget(source) {
		this.muted.delete(source);
	}
	update(talker) {
		talker.muted !== this.muted.has(talker.source) && (talker.muted ? this.muted.add(talker.source) : this.muted.delete(talker.source), MumbleSetPlayerMuted(talker.source, talker.muted));
	}
	radioJoin() {}
	radioLeave() {}
	radioTalk() {}
	callJoin() {}
	callLeave() {}
	rebuild() {}
	stop() {
		for (let source of this.muted) MumbleSetPlayerMuted(source, !1);
		this.muted.clear();
	}
	describe() {
		return [`server-muted: ${[...this.muted].join(",") || "none"}`];
	}
};
// resource/server/index.ts
const log = createLogger(ResourceName);
aiLogChannels({ mutes: {} });
function chooseBackend() {
	let wanted = content.settings.backend, enhanced = wanted !== "mumble" && hasEnhancedVoice();
	return wanted === "enhanced" && !enhanced && log.error("Enhanced voice API missing on this server, using Mumble"), enhanced ? "enhanced" : "mumble";
}
const backend = chooseBackend(), router = backend === "enhanced" ? new EnhancedRouter(() => content.settings.modes.map((m) => m.distance)) : new MumbleRouter();
new GlobalKey(KEYS.backend, parseBackend).set(backend), log.info(`voice backend: ${backend}`);
const players = new Players(router), groups = new Groups(players, router), mutes = new Mutes(players);
registerServerExports(players, groups, mutes, router);
for (let id of getPlayers()) {
	let source = Number(id), mode = proximityBag.get(source)?.index, radio = radioBag.get(source) ?? 0, call = callBag.get(source) ?? 0;
	players.join(source), mode !== void 0 && players.setMode(source, mode), radio > 0 && groups.setRadio(source, radio, !0), call > 0 && groups.setCall(source, call, !0);
}
on("playerJoining", () => players.join(eventSource())), on("playerDropped", () => {
	let source = eventSource();
	groups.drop(source), mutes.clear(source), players.drop(source);
}), content.onSettings((next, old) => {
	JSON.stringify(next.modes) !== JSON.stringify(old.modes) && players.reload(), next.backend !== old.backend && log.warn("the voice backend changes on the next start of ai-voice");
});
const toIndex = ([v]) => asArgs(typeof v == "number" && Number.isInteger(v) && v >= 1 ? v : null), toRange = ([v]) => v == null ? [null] : typeof v == "number" && v >= .5 && v <= 100 ? [v] : null, toChannelArg = ([v]) => asArgs(isChannel(v) ? v : null);
onClientEvent(EVENTS.setMode, { args: toIndex }, (source, index) => players.setMode(source, index)), onClientEvent(EVENTS.setRange, { args: toRange }, (source, range) => players.setRange(source, range)), onClientEvent(PMA.setPlayerRadio, { args: toChannelArg }, (source, channel) => groups.setRadio(source, channel, !1)), onClientEvent(PMA.setTalkingOnRadio, { args: ([v]) => asArgs(typeof v == "boolean" ? v : null) }, (source, talking) => groups.setRadioTalking(source, talking)), onClientEvent(PMA.setPlayerCall, { args: toChannelArg }, (source, channel) => groups.setCall(source, channel, !1)), addCommand("muteply", {
	help: Locale("COMMAND_MUTE"),
	restricted: !0,
	params: [{
		name: "id",
		type: "playerId",
		help: Locale("COMMAND_P_ID")
	}, {
		name: "seconds",
		type: "number",
		help: Locale("COMMAND_P_SECONDS"),
		optional: !0
	}]
}, (source, args) => mutes.toggle(args.id, source, args.seconds ?? 900)), addCommand("voicedebug", {
	help: Locale("COMMAND_DEBUG"),
	restricted: !0
}, () => {
	log.info(`backend ${router.backend}`);
	for (let p of players.all()) log.info(`${p.source}: range ${p.distance} m (mode ${p.mode}) radio ${p.radio} call ${p.call}${p.muted ? " muted" : ""}`);
	for (let line of [...groups.describe(), ...router.describe()]) log.info(line);
}), on("onResourceStop", (resource) => {
	resource === ResourceName && router.stop();
});
