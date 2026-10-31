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
function int$1(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num(value, fallback, min, max));
}
function bool(value, fallback) {
	return typeof value == "boolean" ? value : fallback;
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function record(value) {
	return typeof value == "object" && value && !Array.isArray(value) ? value : {};
}
// ../../../packages/lib/src/shared/access.ts
const names = (v) => Array.isArray(v) ? v.filter((x) => typeof x == "string") : [];
function readAccess(value) {
	let v = record(value), grades = {};
	for (let [name, grade] of Object.entries(record(v.grades))) typeof grade == "number" && Number.isInteger(grade) && grade >= 0 && (grades[name] = grade);
	return {
		jobs: names(v.jobs),
		gangs: names(v.gangs),
		grades,
		onDuty: bool(v.onDuty, !1)
	};
}
const isPublic = (rule) => rule.jobs.length === 0 && rule.gangs.length === 0, ACCESS_FIELDS = {
	jobs: {
		type: "names",
		lookup: "job",
		optional: !0
	},
	gangs: {
		type: "names",
		lookup: "gang",
		optional: !0
	},
	onDuty: {
		type: "bool",
		optional: !0
	}
};
function accessFields() {
	return [
		{
			widget: "tags",
			lookup: "job",
			path: "jobs",
			label: "ADMIN_F_ACCESS_JOBS",
			hint: "ADMIN_H_ACCESS_JOBS",
			placeholder: "ADMIN_P_ACCESS_JOBS"
		},
		{
			widget: "tags",
			lookup: "gang",
			path: "gangs",
			label: "ADMIN_F_ACCESS_GANGS",
			hint: "ADMIN_H_ACCESS_GANGS",
			placeholder: "ADMIN_P_ACCESS_GANGS"
		},
		{
			widget: "switch",
			path: "onDuty",
			label: "ADMIN_F_ACCESS_ON_DUTY",
			hint: "ADMIN_H_ACCESS_ON_DUTY"
		}
	];
}
// ../../../packages/lib/src/shared/records.ts
const isObject = (value) => typeof value == "object" && !!value && !Array.isArray(value);
function readRecords(raw, readOne) {
	let out = new Map();
	if (!isObject(raw)) return out;
	for (let key in raw) {
		let value = raw[key];
		if (!isObject(value)) continue;
		let parsed = readOne(key, value);
		parsed !== null && out.set(key, parsed);
	}
	return out;
}
var FileViews = class {
	read;
	updaters = new Map();
	constructor(read) {
		this.read = read;
	}
	view(file, parse) {
		let box = { value: parse(this.read(file)) };
		return this.on(file, () => box.value = parse(this.read(file))), box;
	}
	records(file, readOne) {
		let live = new LiveRecords(readOne);
		return live.reset(this.read(file)), this.on(file, (key, value) => live.update(key, value, this.read(file))), live.map;
	}
	changed(file, key, value) {
		for (let update of this.updaters.get(file) ?? []) update(key, value);
	}
	on(file, update) {
		let list = this.updaters.get(file);
		list ? list.push(update) : this.updaters.set(file, [update]);
	}
}, LiveRecords = class {
	readOne;
	map = new Map();
	constructor(readOne) {
		this.readOne = readOne;
	}
	reset(raw) {
		this.map.clear();
		for (let [key, value] of readRecords(raw, this.readOne)) this.map.set(key, value);
	}
	update(key, value, whole) {
		if (key === void 0) return this.reset(whole);
		let parsed = isObject(value) ? this.readOne(key, value) : null;
		parsed === null ? this.map.delete(key) : this.map.set(key, parsed);
	}
};
// ../../../packages/lib/src/shared/lang.ts
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function previewJson(value, max) {
	let out = "", walk = (v, depth) => {
		if (out.length >= max) return;
		if (typeof v == "string") {
			out += JSON.stringify(v.length > max ? v.slice(0, max) : v);
			return;
		}
		if (typeof v != "object" || !v) {
			out += String(v);
			return;
		}
		if (depth > 4) {
			out += Array.isArray(v) ? "[...]" : "{...}";
			return;
		}
		if (Array.isArray(v)) {
			out += "[";
			for (let i = 0; i < v.length && out.length < max; i++) i > 0 && (out += ","), walk(v[i], depth + 1);
			out += "]";
			return;
		}
		out += "{";
		let first = !0;
		for (let key in v) {
			if (out.length >= max) break;
			first || (out += ","), first = !1, out += `${JSON.stringify(key.slice(0, 50))}:`, walk(v[key], depth + 1);
		}
		out += "}";
	};
	return walk(value, 0), out.slice(0, max);
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
	metaChangedEvent: "ai-core:metaChanged",
	definitionsChangedEvent: "ai-core:definitionsChanged",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	characterLooksEvent: "ai-core:client:characterLooks",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	clientWorldSyncEvent: "ai-core:client:worldSync",
	clientDefinitionsEvent: "ai-core:client:definitions",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	pvpStateKey: "ai:pvp",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	spawnEvent: "ai-core:client:spawn",
	chooseSpawnEvent: "ai-core:client:chooseSpawn",
	spawnChoiceCallback: "ai-core:spawnChoice",
	openCharactersEvent: "ai-core:client:openCharacters"
}, PLAYER_BAGS = {
	dead: "dead",
	cuffed: "cuffed",
	proximity: "proximity"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	panelDataCallback: "ai-core:admin:panelData",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	recommendationEvent: "ai-core:admin:recommendation",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, LIB_UI = {
	resource: "ai-lib",
	notifyEvent: "ai-lib:client:notify",
	promptPressedEvent: "ai-lib:client:promptPressed",
	cancelProgressEvent: "ai-lib:client:cancelProgress",
	progressForCallback: "ai-lib:progressFor",
	progressForCancelEvent: "ai-lib:client:progressForCancel",
	minigameForCallback: "ai-lib:minigameFor"
}, named = new Set();
function registerExport(name, handler) {
	named.add(name), globalThis.exports(name, handler);
	let first = name.charAt(0), twin = (first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase()) + name.slice(1);
	twin !== name && !named.has(twin) && globalThis.exports(twin, handler);
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
// ../../../packages/lib/src/server/position.ts
function entityCoords(entity) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
	return {
		x,
		y,
		z
	};
}
const coordsOf = (source) => entityCoords(GetPlayerPed(String(source)));
resourceExport(CORE.resource);
const log$12 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	refusals = new Map();
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source))) return null;
		if (!this.limit.take(source)) return this.refuse(source, "rate limit"), null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, () => `invalid arguments ${logSafe(previewJson(raw, 200), 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source), this.refusals.delete(source);
	}
	refuse(source, reason) {
		let now = GetGameTimer(), last = this.refusals.get(source);
		if (last && now - last.at < 1e4) {
			last.skipped++;
			return;
		}
		let more = last?.skipped ? ` (+${last.skipped} more refused)` : "";
		this.refusals.set(source, {
			at: now,
			skipped: 0
		}), log$12.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${typeof reason == "string" ? reason : reason()}${more}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$11 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
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
			log$11.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
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
		case "run": return typeof value.id == "string" && value.id.length <= 64 ? {
			file: value.file,
			action: "run",
			key,
			id: value.id
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
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$16 = resourceExport(CORE.resource), ERR = {
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
			list = core$16.GetLookupValues(source);
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
// ../../../packages/lib/src/server/admin/edit.ts
const DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
function linked(spec, value, ctx) {
	return spec.type === "text" && spec.records && typeof value == "string" && value !== "" && !(value in ctx.get(spec.records)) ? "ADMIN_ERR_LOOKUP" : null;
}
function checkEdit(patch, spec, ctx) {
	let data = ctx.get(patch.file);
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
				let link = linked(section, record[name], ctx);
				if (link) return link;
			}
			let ruled = ctx.rule(patch.file)?.(key, record);
			if (ruled) return ruled;
		}
		return null;
	}
	let section = spec.sections[patch.section];
	if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
	let refusal = validate(section, patch.value, patch.section);
	if (refusal) return refusal.error;
	let link = linked(section, patch.value, ctx);
	if (link) return link;
	let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
		...isRecord(current) ? current : {},
		[patch.section]: patch.value
	};
	return ctx.rule(patch.file)?.(patch.key, next) ?? null;
}
function applyEdit(data, patch, spec) {
	if (patch.action === "import") {
		for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
		return Object.keys(patch.records);
	}
	if (patch.action === "create") {
		let record = clone(spec.newRecord ?? {});
		spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
	} else if (patch.action === "delete") delete data[patch.key];
	else {
		let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!isRecord(target)) return [];
		patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
	}
	return [spec.kind === "records" ? patch.key : void 0];
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
		if (field.widget === "action") continue;
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
const core$15 = resourceExport(CORE.resource);
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	actions = new Map();
	views = new FileViews((file) => this.get(file));
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	editor = 0;
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelData", () => this.dataSnapshot()), registerExport("AdminPanelSummary", () => this.summary()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges), { rate: {
			count: 4,
			windowMs: 1e4
		} }), setImmediate(() => core$15.RegisterAdminPanel(this.resource));
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
	onAction(id, handler) {
		this.actions.set(id, handler);
	}
	view(file, read) {
		return this.views.view(file, read);
	}
	records(file, readOne) {
		return this.views.records(file, readOne);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: this.dataSnapshot()
		};
	}
	dataSnapshot() {
		return clone(Object.fromEntries(this.data));
	}
	summary() {
		let data = {}, index = {};
		for (let [file, spec] of Object.entries(this.schema.files)) {
			let content = this.data.get(file);
			if (spec.kind !== "records") {
				data[file] = clone(content ?? {});
				continue;
			}
			let labels = {};
			for (let [key, record] of Object.entries(content ?? {})) labels[key] = labelOf(record, spec.labelPath) ?? key;
			index[file] = labels;
		}
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data,
			loaded: !1,
			index
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec) return {
			ok: !1,
			error: ERR.type
		};
		this.editor = admin;
		try {
			if (patch.action === "run") return this.run(admin, patch, spec);
			if (spec.memory) return {
				ok: !1,
				error: ERR.type
			};
			let error = checkEdit(patch, spec, {
				get: (file) => this.get(file),
				rule: (file) => this.rules.get(file)
			});
			return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${previewJson(patch, 300)}`), {
				ok: !1,
				error
			}) : (this.store(patch, spec), { ok: !0 });
		} finally {
			this.editor = 0;
		}
	}
	run(admin, patch, spec) {
		let handler = this.actions.get(patch.id), data = this.get(patch.file), target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!handler || !isRecord(target)) return {
			ok: !1,
			error: ERR.type
		};
		try {
			let error = handler(admin, clone(target), patch.key);
			return error ? {
				ok: !1,
				error
			} : { ok: !0 };
		} catch (error) {
			return this.log.error(`panel action ${patch.id} failed`, error), {
				ok: !1,
				error: ERR.type
			};
		}
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	commitAfter(file, key, value) {
		setImmediate(() => this.commit(file, key, value));
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {}, keys = applyEdit(data, patch, spec);
		if (keys.length !== 0) {
			this.data.set(patch.file, data);
			for (let key of keys) this.changed(patch.file, key);
		}
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data), this.views.changed(file, key, value);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$15.AdminPanelChanged({
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
function labelOf(record, path) {
	if (!path) return null;
	let at = record;
	for (let part of path.split(".")) {
		if (typeof at != "object" || !at) return null;
		at = at[part];
	}
	return typeof at == "string" && at !== "" ? at : null;
}
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
	emitNet(LIB_UI.notifyEvent, source, notification);
}
resourceExport(CORE.resource);
// ../../../packages/lib/src/server/online.ts
const core$13 = resourceExport(CORE.resource);
function reindex(index, source, before, after) {
	for (let name of before) {
		let set = index.get(name);
		set && (set.delete(source), set.size === 0 && index.delete(name));
	}
	for (let name of after) {
		let set = index.get(name);
		set || index.set(name, set = new Set()), set.add(source);
	}
}
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	jobIndex = new Map();
	gangIndex = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.drop(source), this.players.set(source, {
				character,
				jobs: [],
				jobNames: [],
				gangs: [],
				gangNames: [],
				duty: null
			}), this.setJobs(source, core$13.GetJobs(source) ?? []), this.setGangs(source, core$13.GetGangs(source) ?? []), this.setDuty(source, core$13.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => this.setJobs(source, jobs)), on(CORE.gangsChangedEvent, (source, gangs) => this.setGangs(source, gangs)), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$13.GetLoadedSources()) {
			let character = core$13.GetCharacter(source);
			character && load(source, character);
		}
	}
	drop(source) {
		let player = this.players.get(source);
		player && (this.setDuty(source, null), reindex(this.jobIndex, source, player.jobNames, []), reindex(this.gangIndex, source, player.gangNames, []), this.players.delete(source));
	}
	setJobs(source, jobs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = jobs.map((m) => m.job);
		reindex(this.jobIndex, source, player.jobNames, names), player.jobs = jobs, player.jobNames = names;
	}
	setGangs(source, gangs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = gangs.map((m) => m.gang);
		reindex(this.gangIndex, source, player.gangNames, names), player.gangs = gangs, player.gangNames = names;
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player) return;
		if (player.duty) {
			let set = this.onDuty.get(player.duty);
			set?.delete(source), set?.size === 0 && this.onDuty.delete(player.duty);
		}
		if (player.duty = job, !job) return;
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
	name(source, options = {}) {
		let c = this.character(source);
		return c ? `${c.firstname} ${c.lastname}` : options.fallback === !1 ? "" : GetPlayerName(String(source));
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobNames ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangNames ?? [];
	}
	jobGrade(source, job) {
		return this.start(), this.players.get(source)?.jobs.find((m) => m.job === job)?.grade ?? null;
	}
	gangGrade(source, gang) {
		return this.start(), this.players.get(source)?.gangs.find((m) => m.gang === gang)?.grade ?? null;
	}
	jobMembers(job) {
		return this.start(), this.jobIndex.get(job) ?? EMPTY;
	}
	gangMembers(gang) {
		return this.start(), this.gangIndex.get(gang) ?? EMPTY;
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyIn(source, jobs) {
		let duty = this.dutyJob(source);
		return duty !== null && jobs.includes(duty);
	}
	allows(source, rule) {
		if (isPublic(rule)) return !0;
		let min = (name) => rule.grades[name] ?? 0;
		for (let gang of rule.gangs) {
			let grade = this.gangGrade(source, gang);
			if (grade !== null && grade >= min(gang)) return !0;
		}
		let duty = rule.onDuty ? this.dutyJob(source) : null;
		for (let job of rule.jobs) {
			let grade = this.jobGrade(source, job);
			if (grade !== null && grade >= min(job) && (!rule.onDuty || duty === job)) return !0;
		}
		return !1;
	}
	countOnDuty(jobs) {
		this.start();
		let count = 0;
		for (let job of jobs) count += this.onDuty.get(job)?.size ?? 0;
		return count;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set(), online = new OnlinePlayers();
resourceExport(CORE.resource);
// ../../../packages/lib/src/server/proximity.ts
const core$11 = resourceExport(CORE.resource);
function within(point, radius, candidates) {
	let out = [];
	for (let source of candidates) {
		let p = coordsOf(source);
		Math.hypot(p.x - point.x, p.y - point.y, p.z - point.z) <= radius && out.push(source);
	}
	return out;
}
function playersNear(source, radius) {
	return within(coordsOf(source), radius, [source, ...core$11.GetPlayersInScope(source)]);
}
createLogger(GetCurrentResourceName());
const dropped = new Set();
let listening$1 = !1;
function onDropped(fn) {
	listening$1 || (listening$1 = !0, on("playerDropped", () => {
		let source = Number(globalThis.source);
		for (let handler of dropped) handler(source);
	})), dropped.add(fn);
}
var PlayerMap = class extends Map {
	constructor(options = {}) {
		super(), onDropped((source) => {
			if (!this.has(source)) return;
			let value = this.get(source);
			this.delete(source), options.onDrop?.(source, value);
		});
	}
};
// ../../../packages/lib/src/server/progressFor.ts
const running = new PlayerMap({ onDrop: (_source, settle) => settle(!1) });
on(CORE.playerUnloadedEvent, (source) => {
	let settle = running.get(source);
	settle && settle(!1);
});
// ../../../packages/lib/src/server/definitions.ts
const core$10 = resourceExport("ai-core");
new class {
	jobs = new Map();
	gangs = new Map();
	constructor() {
		on(CORE.definitionsChangedEvent, (file, name) => {
			typeof name == "string" && (file === "jobs" ? this.jobs.delete(name) : file === "gangs" && this.gangs.delete(name));
		});
	}
	job(name) {
		let def = this.jobs.get(name);
		return def === void 0 && this.jobs.set(name, def = core$10.GetJobDefinition(name) ?? null), def;
	}
	gang(name) {
		let def = this.gangs.get(name);
		return def === void 0 && this.gangs.set(name, def = core$10.GetGangDefinition(name) ?? null), def;
	}
}();
// ../../../packages/lib/src/server/command.ts
const resource = GetCurrentResourceName(), log$9 = createLogger(resource);
let texts = null;
const t = (key, ...args) => formatText((texts ??= loadLocaleTexts(CORE.resource))[key] ?? key, args);
function reply(source, text, kind) {
	source > 0 ? notify(source, text, kind) : log$9.info(text);
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
		let fail = (error) => log$9.error(`command /${name} failed`, error);
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
const log$8 = createLogger(GetCurrentResourceName());
function onClientEvent(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 10);
	onNet(name, (...raw) => {
		let source = Number(globalThis.source), args = gate.check(source, raw);
		args && gate.run(source, void 0, () => handler(source, ...args)).catch((error) => log$8.error(`event ${name} failed for ${source}`, error));
	});
}
createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/byResource.ts
function caller() {
	let invoking = GetInvokingResource();
	return invoking != null && invoking !== "" ? invoking : GetCurrentResourceName();
}
const stopHandlers = [];
let listening = !1;
function onStop(handler) {
	if (stopHandlers.push(handler), listening) return;
	listening = !0;
	let event = IsDuplicityVersion() ? "onResourceStop" : "onClientResourceStop";
	on(event, (resource) => {
		for (let stop of stopHandlers) stop(resource);
	});
}
var ByResource = class {
	options;
	byOwner = new Map();
	owners = new Map();
	constructor(options = {}) {
		this.options = options, onStop((resource) => this.dropResource(resource));
	}
	set(key, value, owner = caller()) {
		let previous = this.owners.get(key);
		previous !== void 0 && previous !== owner && this.byOwner.get(previous)?.delete(key);
		let map = this.byOwner.get(owner);
		map || this.byOwner.set(owner, map = new Map()), map.set(key, value), this.owners.set(key, owner);
	}
	get(key) {
		let owner = this.owners.get(key);
		return owner === void 0 ? void 0 : this.byOwner.get(owner)?.get(key);
	}
	ownerOf(key) {
		return this.owners.get(key);
	}
	delete(key) {
		let owner = this.owners.get(key);
		if (owner === void 0) return !1;
		this.owners.delete(key);
		let map = this.byOwner.get(owner);
		return map?.delete(key), map?.size === 0 && this.byOwner.delete(owner), !0;
	}
	*values() {
		for (let map of this.byOwner.values()) yield* map.values();
	}
	*entries() {
		for (let map of this.byOwner.values()) yield* map.entries();
	}
	get size() {
		return this.owners.size;
	}
	dropResource(resource) {
		let map = this.byOwner.get(resource);
		if (map) {
			this.byOwner.delete(resource);
			for (let [key, value] of map) this.owners.delete(key), this.options.onDrop?.(resource, key, value);
		}
	}
};
let log$6 = null;
var ScheduledJob = class {
	interval;
	fn;
	name;
	gen = 0;
	active = !1;
	stopped = !1;
	quietUntil = 0;
	skipped = 0;
	constructor(interval, fn, name) {
		this.interval = interval, this.fn = fn, this.name = name;
	}
	get running() {
		return this.active;
	}
	set(active) {
		active === this.active || active && this.stopped || (this.active = active, active ? scheduler.activate(this) : scheduler.deactivate(this));
	}
	stop() {
		this.set(!1), this.stopped = !0;
	}
	call() {
		try {
			let result = this.fn();
			result instanceof Promise && result.catch((error) => this.fail(error));
		} catch (error) {
			this.fail(error);
		}
	}
	fail(error) {
		let now = GetGameTimer();
		if (now < this.quietUntil) {
			this.skipped++;
			return;
		}
		this.quietUntil = now + 1e4;
		let more = this.skipped ? ` (+${this.skipped} more)` : "";
		this.skipped = 0, log$6 ??= createLogger(GetCurrentResourceName()), log$6.error(`job "${this.name}" failed${more}`, error instanceof Error ? error.stack ?? error.message : error);
	}
}, Group = class {
	interval;
	jobs = Array(8);
	gens = Array(8).fill(0);
	dues = Array(8).fill(0);
	head = 0;
	mask = 7;
	count = 0;
	constructor(interval) {
		this.interval = interval;
	}
	get front() {
		return this.dues[this.head] ?? 0;
	}
	compactAt = 64;
	push(job, due) {
		this.count >= this.compactAt && this.compact(), this.count > this.mask && this.grow();
		let i = this.head + this.count & this.mask;
		this.jobs[i] = job, this.gens[i] = job.gen, this.dues[i] = due, this.count++;
	}
	run(now) {
		for (let left = this.count; left > 0 && this.count > 0; left--) {
			let i = this.head, due = this.dues[i] ?? 0;
			if (due > now) return;
			let job = this.jobs[i], gen = this.gens[i];
			if (this.jobs[i] = void 0, this.head = i + 1 & this.mask, this.count--, !job || job.gen !== gen) continue;
			let next = due + this.interval;
			next <= now && (next = now + this.interval), this.push(job, next), job.call();
		}
	}
	compact() {
		let kept = 0;
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask, job = this.jobs[i];
			if (!job || job.gen !== this.gens[i]) continue;
			let k = this.head + kept & this.mask;
			this.jobs[k] = job, this.gens[k] = this.gens[i] ?? 0, this.dues[k] = this.dues[i] ?? 0, kept++;
		}
		for (let n = kept; n < this.count; n++) this.jobs[this.head + n & this.mask] = void 0;
		this.count = kept, this.compactAt = Math.max(64, kept * 2);
	}
	grow() {
		let size = (this.mask + 1) * 2, jobs = Array(size), gens = Array(size).fill(0), dues = Array(size).fill(0);
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask;
			jobs[n] = this.jobs[i], gens[n] = this.gens[i] ?? 0, dues[n] = this.dues[i] ?? 0;
		}
		this.jobs = jobs, this.gens = gens, this.dues = dues, this.head = 0, this.mask = size - 1;
	}
};
const scheduler = new class {
	groups = [];
	byInterval = new Map();
	tick = null;
	active = 0;
	nextDue = Infinity;
	running = !1;
	activate(job) {
		job.gen++, this.active++;
		let due = GetGameTimer() + job.interval, group = this.byInterval.get(job.interval);
		group || (group = new Group(job.interval), this.byInterval.set(job.interval, group), this.groups.push(group)), group.push(job, due), due < this.nextDue && (this.nextDue = due), this.tick ??= setTick(this.onTick);
	}
	deactivate(job) {
		job.gen++, this.active--, this.active === 0 && !this.running && this.halt();
	}
	halt() {
		this.tick !== null && clearTick(this.tick), this.tick = null, this.groups.length = 0, this.byInterval.clear(), this.nextDue = Infinity;
	}
	onTick = () => {
		let now = GetGameTimer();
		if (now < this.nextDue) return;
		let groups = this.groups;
		this.running = !0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && group.count > 0 && group.front <= now && group.run(now);
		}
		if (this.running = !1, this.active === 0) return this.halt();
		let soonest = Infinity, kept = 0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && (group.count === 0 ? this.byInterval.delete(group.interval) : (groups[kept++] = group, group.front < soonest && (soonest = group.front)));
		}
		groups.length = kept, this.nextDue = soonest;
	};
}();
function every(ms, fn, options = {}) {
	let job = new ScheduledJob(Math.max(0, Math.floor(ms)), fn, options.name ?? (fn.name || "anonymous"));
	return options.active !== !1 && job.set(!0), job;
}
// ../../../packages/lib/src/fivem/state.ts
const stateNumber = (v) => typeof v == "number" && Number.isFinite(v) ? v : void 0, stateBoolean = (v) => typeof v == "boolean" ? v : void 0, stateString = (v) => typeof v == "string" ? v : void 0, isServer = IsDuplicityVersion();
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
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
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
	setRange: "ai-voice:setRange",
	radioListen: "ai-voice:radioListen",
	radioActive: "ai-voice:radioActive",
	setSpeaker: "ai-voice:setSpeaker",
	callAudio: "ai-voice:callAudio"
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
	playerMuted: "pma-voice:playerMuted",
	registerCustomSubmixes: "pma-voice:registerCustomSubmixes"
}, KEYS = {
	backend: "ai-voice:backend",
	takeover: "ai-voice:takeover",
	radioChannel: "radioChannel",
	callChannel: "callChannel",
	muted: "muted",
	submix: "submix",
	callSpeaker: "callSpeaker",
	isDead: "isDead"
}, parseBackend = (v) => v === "mumble" || v === "enhanced" ? v : void 0, parseTakeover = (v) => isRecord(v) ? {
	radio: typeof v.radio == "string" ? v.radio : null,
	phone: typeof v.phone == "string" ? v.phone : null
} : void 0, parseProximity = (v) => isRecord(v) && typeof v.index == "number" && typeof v.distance == "number" && typeof v.mode == "string" ? {
	index: v.index,
	distance: v.distance,
	mode: v.mode
} : void 0, RANGE_MIN = .5, CHANNEL_MAX = 1e6, isChannel = (v) => typeof v == "number" && Number.isFinite(v) && v >= 0 && v <= 1e6, toChannel = (v) => {
	let n = typeof v == "string" ? Number(v) : v;
	return isChannel(n) ? n : null;
}, ANIM_SETS = {
	shoulder: {
		dict: "random@arrests",
		clip: "generic_radio_enter",
		flag: 50
	},
	chatter: {
		dict: "random@arrests",
		clip: "generic_radio_chatter",
		flag: 49
	},
	handheld: {
		dict: "cellphone@",
		clip: "cellphone_text_read_base",
		flag: 49
	}
}, ANIM_SET_NAMES = [
	"shoulder",
	"chatter",
	"handheld",
	"custom"
], DEFAULT_MODES = [
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
const animSet = (v, fallback) => typeof v == "string" && ANIM_SET_NAMES.includes(v) ? v : fallback;
function readSettings(raw) {
	let modes = readModes(raw.modes), backend = raw.backend;
	return {
		backend: backend === "enhanced" || backend === "mumble" ? backend : "auto",
		modes,
		defaultMode: int$1(raw.defaultMode, 2, 1, modes.length),
		cycle: bool(raw.cycle, !0),
		rangeFactor: num(raw.rangeFactor, 3, 1, 5),
		radio: bool(raw.radio, !0),
		radioVolume: int$1(raw.radioVolume, 30, 0, 100),
		maxRadioChannels: int$1(raw.maxRadioChannels, 3, 1, 10),
		radioAnim: bool(raw.radioAnim, !1),
		radioAnimSet: animSet(raw.radioAnimSet, "shoulder"),
		radioAnimCustom: {
			dict: str(raw.radioAnimDict, ANIM_SETS.shoulder.dict, 64),
			clip: str(raw.radioAnimClip, ANIM_SETS.shoulder.clip, 64),
			flag: int$1(raw.radioAnimFlag, 49, 0, 1023)
		},
		radioAnimInVehicle: bool(raw.radioAnimInVehicle, !0),
		radioSubmix: bool(raw.radioSubmix, !0),
		micClicks: bool(raw.micClicks, !0),
		syncNames: bool(raw.syncNames, !1),
		phone: bool(raw.phone, !0),
		phoneVolume: int$1(raw.phoneVolume, 60, 0, 100),
		phoneSubmix: bool(raw.phoneSubmix, !0),
		clientCalls: bool(raw.clientCalls, !1),
		speaker: bool(raw.speaker, !0),
		speakerRadius: num(raw.speakerRadius, 3, .5, 15),
		speakerVolume: int$1(raw.speakerVolume, 60, 0, 100),
		speakerBidirectional: bool(raw.speakerBidirectional, !0)
	};
}
const readFrequency = (_key, value) => ({
	label: str(value.label, "", 48),
	from: num(value.from, 0),
	to: num(value.to, 0),
	access: {
		...readAccess(value),
		onDuty: bool(value.onDuty, !0)
	},
	anim: typeof value.anim == "string" ? value.anim : ""
});
function frequencyOf(list, channel) {
	for (let f of list) if (channel >= f.from && channel <= f.to) return f;
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
const volume$1 = {
	type: "number",
	min: 0,
	max: 100,
	integer: !0
}, pct = (path, label, hint) => ({
	widget: "number",
	path,
	label,
	hint,
	min: 0,
	max: 100,
	unit: "%"
}), animOptions = [
	{
		value: "shoulder",
		label: "ADMIN_O_ANIM_SHOULDER"
	},
	{
		value: "chatter",
		label: "ADMIN_O_ANIM_CHATTER"
	},
	{
		value: "handheld",
		label: "ADMIN_O_ANIM_HANDHELD"
	},
	{
		value: "custom",
		label: "ADMIN_O_ANIM_CUSTOM"
	}
], SETTINGS_DEFAULTS = {
	backend: "auto",
	modes: DEFAULT_MODES,
	defaultMode: 2,
	cycle: !0,
	rangeFactor: 3,
	radio: !0,
	radioVolume: 30,
	maxRadioChannels: 3,
	radioAnim: !1,
	radioAnimSet: "shoulder",
	radioAnimDict: ANIM_SETS.shoulder.dict,
	radioAnimClip: ANIM_SETS.shoulder.clip,
	radioAnimFlag: 49,
	radioAnimInVehicle: !0,
	radioSubmix: !0,
	micClicks: !0,
	syncNames: !1,
	phone: !0,
	phoneVolume: 60,
	phoneSubmix: !0,
	clientCalls: !1,
	speaker: !0,
	speakerRadius: 3,
	speakerVolume: 60,
	speakerBidirectional: !0
}, schema = {
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
				rangeFactor: {
					type: "number",
					min: 1,
					max: 5
				},
				radio: { type: "bool" },
				radioVolume: volume$1,
				maxRadioChannels: {
					type: "number",
					min: 1,
					max: 10,
					integer: !0
				},
				radioAnim: { type: "bool" },
				radioAnimSet: {
					type: "enum",
					values: ANIM_SET_NAMES
				},
				radioAnimDict: {
					type: "text",
					min: 1,
					max: 64
				},
				radioAnimClip: {
					type: "text",
					min: 1,
					max: 64
				},
				radioAnimFlag: {
					type: "number",
					min: 0,
					max: 1023,
					integer: !0
				},
				radioAnimInVehicle: { type: "bool" },
				radioSubmix: { type: "bool" },
				micClicks: { type: "bool" },
				syncNames: { type: "bool" },
				phone: { type: "bool" },
				phoneVolume: volume$1,
				phoneSubmix: { type: "bool" },
				clientCalls: { type: "bool" },
				speaker: { type: "bool" },
				speakerRadius: {
					type: "number",
					min: .5,
					max: 15
				},
				speakerVolume: volume$1,
				speakerBidirectional: { type: "bool" },
				backendActive: {
					type: "enum",
					values: ["mumble", "enhanced"],
					optional: !0
				},
				radioEffectBy: {
					type: "text",
					max: 64,
					optional: !0
				},
				phoneEffectBy: {
					type: "text",
					max: 64,
					optional: !0
				}
			},
			defaults: SETTINGS_DEFAULTS
		},
		channels: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				from: 1,
				to: 10,
				jobs: ["police"],
				onDuty: !0,
				anim: ""
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
				...ACCESS_FIELDS,
				anim: {
					type: "enum",
					values: [
						"",
						"none",
						...ANIM_SET_NAMES
					],
					optional: !0
				}
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
				}, {
					widget: "info",
					path: "backendActive",
					label: "ADMIN_F_BACKEND_ACTIVE",
					values: {
						enhanced: "ADMIN_O_ENHANCED",
						mumble: "ADMIN_O_MUMBLE"
					}
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
					},
					{
						widget: "number",
						path: "rangeFactor",
						label: "ADMIN_F_RANGE_FACTOR",
						hint: "ADMIN_H_RANGE_FACTOR",
						min: 1,
						max: 5,
						step: .5,
						unit: "x"
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
					pct("radioVolume", "ADMIN_F_RADIO_VOLUME", "ADMIN_H_VOLUME"),
					{
						widget: "number",
						path: "maxRadioChannels",
						label: "ADMIN_F_MAX_CHANNELS",
						hint: "ADMIN_H_MAX_CHANNELS",
						min: 1,
						max: 10
					},
					{
						widget: "switch",
						path: "radioSubmix",
						label: "ADMIN_F_RADIO_SUBMIX",
						hint: "ADMIN_H_SUBMIX"
					},
					{
						widget: "info",
						path: "radioEffectBy",
						label: "ADMIN_F_EFFECT_BY",
						hint: "ADMIN_H_EFFECT_BY",
						empty: "ADMIN_V_AI_VOICE",
						mono: !0
					},
					{
						widget: "switch",
						path: "micClicks",
						label: "ADMIN_F_MIC_CLICKS",
						hint: "ADMIN_H_MIC_CLICKS"
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
				title: "ADMIN_C_ANIM",
				desc: "ADMIN_C_ANIM_DESC",
				fields: [
					{
						widget: "switch",
						path: "radioAnim",
						label: "ADMIN_F_RADIO_ANIM",
						hint: "ADMIN_H_RADIO_ANIM"
					},
					{
						widget: "select",
						path: "radioAnimSet",
						label: "ADMIN_F_ANIM_SET",
						hint: "ADMIN_H_ANIM_SET",
						options: animOptions
					},
					{
						widget: "text",
						path: "radioAnimDict",
						label: "ADMIN_F_ANIM_DICT",
						placeholder: "ADMIN_P_ANIM_DICT",
						showIf: {
							path: "radioAnimSet",
							values: ["custom"]
						}
					},
					{
						widget: "text",
						path: "radioAnimClip",
						label: "ADMIN_F_ANIM_CLIP",
						placeholder: "ADMIN_P_ANIM_CLIP",
						showIf: {
							path: "radioAnimSet",
							values: ["custom"]
						}
					},
					{
						widget: "number",
						path: "radioAnimFlag",
						label: "ADMIN_F_ANIM_FLAG",
						hint: "ADMIN_H_ANIM_FLAG",
						min: 0,
						max: 1023,
						showIf: {
							path: "radioAnimSet",
							values: ["custom"]
						}
					},
					{
						widget: "switch",
						path: "radioAnimInVehicle",
						label: "ADMIN_F_RADIO_ANIM_VEHICLE"
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
					pct("phoneVolume", "ADMIN_F_PHONE_VOLUME", "ADMIN_H_VOLUME"),
					{
						widget: "switch",
						path: "phoneSubmix",
						label: "ADMIN_F_PHONE_SUBMIX",
						hint: "ADMIN_H_PHONE_SUBMIX"
					},
					{
						widget: "info",
						path: "phoneEffectBy",
						label: "ADMIN_F_EFFECT_BY",
						hint: "ADMIN_H_EFFECT_BY",
						empty: "ADMIN_V_AI_VOICE",
						mono: !0
					},
					{
						widget: "switch",
						path: "clientCalls",
						label: "ADMIN_F_CLIENT_CALLS",
						hint: "ADMIN_H_CLIENT_CALLS"
					},
					{
						widget: "switch",
						path: "speaker",
						label: "ADMIN_F_SPEAKER",
						hint: "ADMIN_H_SPEAKER"
					},
					{
						widget: "number",
						path: "speakerRadius",
						label: "ADMIN_F_SPEAKER_RADIUS",
						hint: "ADMIN_H_SPEAKER_RADIUS",
						min: .5,
						max: 15,
						step: .5,
						unit: "m"
					},
					pct("speakerVolume", "ADMIN_F_SPEAKER_VOLUME", "ADMIN_H_VOLUME"),
					{
						widget: "switch",
						path: "speakerBidirectional",
						label: "ADMIN_F_SPEAKER_TWO_WAY",
						hint: "ADMIN_H_SPEAKER_TWO_WAY"
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
				...accessFields(),
				{
					widget: "select",
					path: "anim",
					label: "ADMIN_F_CHANNEL_ANIM",
					hint: "ADMIN_H_CHANNEL_ANIM",
					options: [
						{
							value: "",
							label: "ADMIN_O_ANIM_DEFAULT"
						},
						{
							value: "none",
							label: "ADMIN_O_ANIM_NONE"
						},
						...animOptions
					]
				}
			]
		}]
	}]
}, log$5 = createLogger(ResourceName), CONVARS = [
	{
		name: "voice_defaultVoiceMode",
		keys: ["defaultMode"],
		read: int
	},
	{
		name: "voice_enableProximityCycle",
		keys: ["cycle"],
		read: flag
	},
	{
		name: "voice_enableRadios",
		keys: ["radio"],
		read: flag
	},
	{
		name: "voice_enablePhones",
		keys: ["phone"],
		read: flag
	},
	{
		name: "voice_defaultRadioVolume",
		keys: ["radioVolume"],
		read: volume
	},
	{
		name: "voice_defaultPhoneVolume",
		keys: ["phoneVolume"],
		read: volume
	},
	{
		name: "voice_defaultCallVolume",
		keys: ["phoneVolume"],
		read: volume
	},
	{
		name: "voice_enableSubmix",
		keys: ["radioSubmix", "phoneSubmix"],
		read: flag
	},
	{
		name: "voice_enableRadioAnim",
		keys: ["radioAnim"],
		read: flag
	},
	{
		name: "voice_disableVehicleRadioAnim",
		keys: ["radioAnimInVehicle"],
		read: (raw) => !flag(raw)
	},
	{
		name: "voice_syncPlayerNames",
		keys: ["syncNames"],
		read: flag
	}
];
function int(raw) {
	let n = Number(raw);
	return Number.isInteger(n) && n >= 1 && n <= 6 ? n : void 0;
}
function flag(raw) {
	return raw === "1" || raw === "true";
}
function volume(raw) {
	let n = Number(raw);
	if (!(!Number.isFinite(n) || n < 0)) return Math.round(Math.min(100, n <= 1 && raw.includes(".") ? n * 100 : n));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function seedFromConvars(panel) {
	let settings = panel.get("settings");
	for (let convar of CONVARS) {
		let raw = GetConvar(convar.name, "");
		if (raw === "") continue;
		let value = convar.read(raw);
		if (value === void 0) log$5.warn(`${convar.name} "${raw}" is not a valid value, ignored`);
		else for (let key of convar.keys) same(settings[key], SETTINGS_DEFAULTS[key]) && (same(value, SETTINGS_DEFAULTS[key]) || (panel.commit("settings", key, value), log$5.info(`${key} set from the cfg convar ${convar.name} (${raw})`)));
	}
}
// resource/server/content.ts
const panel = new AdminPanel(schema);
setImmediate(() => seedFromConvars(panel)), panel.rule("channels", (_key, next) => isRecord(next) && num(next.from, 0) > num(next.to, 0) ? "ADMIN_ERR_CHANNEL_RANGE" : null);
const content = new class {
	settings = readSettings(panel.get("settings"));
	frequencies = panel.records("channels", readFrequency);
	settingsListeners = [];
	frequencyListeners = [];
	constructor() {
		panel.onChange("settings", () => {
			let old = this.settings;
			this.settings = readSettings(panel.get("settings"));
			for (let listener of this.settingsListeners) listener(this.settings, old);
		}), panel.onChange("channels", () => {
			for (let listener of this.frequencyListeners) listener();
		});
	}
	onSettings(listener) {
		this.settingsListeners.push(listener);
	}
	onFrequencies(listener) {
		this.frequencyListeners.push(listener);
	}
	frequencyOf(channel) {
		return frequencyOf(this.frequencies.values(), channel);
	}
	showStatus(values) {
		setImmediate(() => {
			let current = panel.get("settings");
			Object.entries(values).some(([key, value]) => current[key] !== value) && panel.commit("settings", void 0, {
				...current,
				...values
			});
		});
	}
}(), log$4 = createLogger(ResourceName);
function register(map, key, fn) {
	return typeof fn == "function" && (map.set(key, fn), !0);
}
function ask(fn, ...args) {
	try {
		return fn(...args);
	} catch (error) {
		return log$4.error("a voice check from another resource failed", error), !1;
	}
}
const checks = new class {
	radio = new ByResource();
	modes = new ByResource();
	names = new ByResource();
	calls = new ByResource();
	addCallCheck(fn) {
		return register(this.calls, caller(), fn);
	}
	canClientJoinCall(source, call) {
		if (content.settings.clientCalls) return !0;
		for (let fn of this.calls.values()) if (ask(fn, source, call) === !0) return !0;
		return !1;
	}
	addRadioCheck(channel, fn) {
		return register(this.radio, channel, fn);
	}
	addModeCheck(fn) {
		return register(this.modes, caller(), fn);
	}
	setNameGetter(fn) {
		return register(this.names, "name", fn);
	}
	canJoinRadio(source, channel) {
		if (!this.jobAllows(source, channel)) return !1;
		let fn = this.radio.get(channel);
		return !fn || !!ask(fn, source);
	}
	jobAllows(source, channel) {
		let rule = content.frequencyOf(channel);
		return !rule || online.allows(source, rule.access);
	}
	canSetRange(source, index, distance) {
		for (let fn of this.modes.values()) if (ask(fn, source, index, distance) === !1) return !1;
		return !0;
	}
	radioName(source) {
		let fn = this.names.get("name"), custom = fn ? ask(fn, source) : null;
		return typeof custom == "string" ? custom : online.name(source);
	}
}(), log$3 = createLogger(ResourceName);
function registerCommands(players, groups, mutes, router) {
	addCommand("muteply", {
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
		log$3.info(`backend ${router.backend}`);
		for (let p of players.all()) log$3.info(`${p.source}: range ${p.distance} m (mode ${p.mode}) radio ${p.radio} [${[...p.radios].join(",")}] call ${p.call}${p.speaker ? " speaker" : ""}${p.muted ? " muted" : ""}`);
		for (let line of [...groups.describe(), ...router.describe()]) log$3.info(line);
	});
}
// resource/server/natives.ts
const HASH = {
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
		this.modeDistances = modeDistances, this.timer = every(1e3, () => this.watchBuckets(), { name: "voiceBuckets" });
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
	callBystander(source, channel, on, talks) {
		let call = this.calls.get(channel);
		if (!call) return;
		if (!on) return call.remove(source);
		let muted = this.bucketTalker(source)?.muted ?? !1;
		call.add(source, muted || !talks);
	}
	rebuild(talkers) {
		for (let bucket of this.buckets.values()) for (let channel of bucket.channels.values()) channel.destroy();
		this.buckets.clear(), this.bucketOf.clear();
		for (let talker of talkers) this.join(talker);
	}
	stop() {
		this.timer.stop();
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
// resource/server/exports.ts
const submixBag = new PlayerState(KEYS.submix, stateString);
function both(name, fn) {
	registerExport(name, fn), provideExport("pma-voice", name, fn);
}
const toSource = (v) => {
	let n = typeof v == "string" ? Number(v) : v;
	return typeof n == "number" && Number.isInteger(n) && n > 0 ? n : null;
};
function channelArg(value, what) {
	let channel = toChannel(value);
	if (channel === null) throw Error(`'${what}' expected a number`);
	return channel;
}
function registerServerExports(s) {
	both("setPlayerRadio", (source, channel) => {
		let src = toSource(source);
		src && s.groups.setRadio(src, channelArg(channel, "radioChannel"));
	}), both("setPlayerCall", (source, channel) => {
		let src = toSource(source);
		src && s.groups.setCall(src, channelArg(channel, "callChannel"), !0);
	});
	let members = (channel) => {
		let id = toChannel(channel);
		return id === null ? {} : s.groups.radioMembers(id);
	};
	both("getPlayersInRadioChannel", members), both("GetPlayersInRadioChannel", members), both("addChannelCheck", (channel, fn) => {
		if (!checks.addRadioCheck(channelArg(channel, "channel"), fn)) throw Error("'cb' expected a function");
	}), both("overrideRadioNameGetter", (_channel, fn) => {
		if (!checks.setNameGetter(fn)) throw Error("'cb' expected a function");
	}), both("isValidPlayer", (source) => {
		let src = toSource(source);
		return src !== null && s.players.get(src) !== void 0;
	}), registerExport("getBackend", () => s.router.backend), registerExport("setPlayerProximityMode", (source, index) => {
		let src = toSource(source);
		return src !== null && typeof index == "number" && s.players.setMode(src, index);
	}), registerExport("setPlayerRange", (source, range) => {
		let src = toSource(source);
		return src === null ? !1 : range == null ? s.players.setRange(src, null) : typeof range == "number" && range >= .5 && range <= 100 && s.players.setRange(src, range);
	}), registerExport("getPlayerProximity", (source) => {
		let src = toSource(source);
		return src !== null && s.players.get(src)?.proximity() || null;
	}), registerExport("toggleMute", (source, seconds) => {
		let src = toSource(source), time = typeof seconds == "number" && seconds > 0 ? seconds : 900;
		return src !== null && s.mutes.toggle(src, 0, time);
	}), registerExport("addProximityCheck", (fn) => {
		if (!checks.addModeCheck(fn)) throw Error("expected a function");
	}), registerExport("addPlayerRadioListen", (source, channel) => {
		let src = toSource(source);
		return src !== null && s.groups.listen(src, channelArg(channel, "channel"), !0);
	}), registerExport("removePlayerRadioListen", (source, channel) => {
		let src = toSource(source);
		return src !== null && s.groups.listen(src, channelArg(channel, "channel"), !1);
	}), registerExport("setPlayerRadioActive", (source, channel) => {
		let src = toSource(source);
		return src !== null && s.groups.setActive(src, channelArg(channel, "channel"));
	}), registerExport("getPlayerRadioChannels", (source) => {
		let src = toSource(source), player = src === null ? void 0 : s.players.get(src);
		return player ? {
			active: player.radio,
			channels: [...player.radios]
		} : null;
	}), registerExport("addCallCheck", (fn) => {
		if (!checks.addCallCheck(fn)) throw Error("expected a function");
	}), registerExport("setPlayerCallSpeaker", (source, on) => {
		let src = toSource(source);
		return src !== null && s.speakers.set(src, on === !0);
	}), registerExport("getPlayerCallSpeaker", (source) => {
		let src = toSource(source);
		return src !== null && s.speakers.isOn(src);
	}), registerExport("setPlayerSubmix", (source, name) => {
		let src = toSource(source);
		src !== null && submixBag.set(src, typeof name == "string" && name ? name : void 0);
	});
}
// resource/server/players.ts
const proximityBag = new PlayerState(PLAYER_BAGS.proximity, parseProximity), radioBag = new PlayerState(KEYS.radioChannel, stateNumber), callBag = new PlayerState(KEYS.callChannel, stateNumber), mutedBag = new PlayerState(KEYS.muted, stateBoolean), speakerBag = new PlayerState(KEYS.callSpeaker, stateBoolean);
var VoicePlayer = class {
	source;
	mode;
	range = null;
	radio = 0;
	radios = new Set();
	call = 0;
	speaker = !1;
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
	dropHooks = [];
	players = new PlayerMap({ onDrop: (source, player) => {
		for (let hook of this.dropHooks) hook(player);
		this.router.forget(source);
	} });
	constructor(router) {
		this.router = router;
	}
	onDrop(hook) {
		this.dropHooks.push(hook);
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
		return this.players.set(source, player), proximityBag.set(source, player.proximity()), radioBag.set(source, 0), callBag.set(source, 0), mutedBag.set(source, !1), speakerBag.set(source, !1), this.router.join(player), player;
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
		player && player.muted !== muted && (player.muted = muted, mutedBag.set(source, muted), this.router.update(player));
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
	callListeners = [];
	constructor(players, router) {
		this.players = players, this.router = router;
	}
	setRadio(source, channel) {
		let player = this.players.get(source);
		if (player && content.settings.radio) {
			if (channel === 0) {
				for (let ch of player.radios) this.leaveRadio(player, ch);
				return this.activate(player, 0);
			}
			if (player.radios.has(channel)) return this.activate(player, channel);
			if (!checks.canJoinRadio(source, channel)) return this.refuse(player);
			player.radio !== 0 && this.leaveRadio(player, player.radio), this.joinRadio(player, channel), this.activate(player, channel);
		}
	}
	listen(source, channel, on) {
		let player = this.players.get(source);
		return !player || !content.settings.radio || channel === 0 ? !1 : on ? player.radios.has(channel) ? !0 : player.radios.size >= content.settings.maxRadioChannels || !checks.canJoinRadio(source, channel) ? !1 : (this.joinRadio(player, channel), player.radio === 0 && this.activate(player, channel), !0) : player.radios.has(channel) ? (this.leaveRadio(player, channel), player.radio === channel && this.activate(player, player.radios.values().next().value ?? 0), !0) : !1;
	}
	setActive(source, channel) {
		let player = this.players.get(source);
		return player?.radios.has(channel) ? (this.activate(player, channel), !0) : !1;
	}
	setRadioTalking(source, talking) {
		let player = this.players.get(source);
		player && this.talk(player, talking);
	}
	talk(player, talking) {
		let { source, radio: channel } = player, members = this.radios.get(channel);
		if (members?.has(source) && members.get(source) !== talking) {
			members.set(source, talking);
			for (let member of members.keys()) member !== source && emitNet(PMA.setTalkingOnRadio, member, source, talking, channel);
			this.router.radioTalk(source, channel, talking);
		}
	}
	setCall(source, channel, fromScript) {
		let player = this.players.get(source);
		if (!player || !content.settings.phone || (fromScript && emitNet(PMA.clSetPlayerCall, source, channel), player.call === channel)) return;
		let old = player.call;
		old !== 0 && this.leaveCall(source, old), player.call = channel, channel !== 0 && this.joinCall(source, channel), callBag.set(source, channel);
		for (let listener of this.callListeners) listener(source, old);
	}
	refuseCall(source) {
		emitNet(PMA.removePlayerFromCall, source, source);
	}
	onCallChange(listener) {
		this.callListeners.push(listener);
	}
	callMembers(channel) {
		return this.calls.get(channel) ?? new Map();
	}
	radioMembers(channel) {
		let members = this.radios.get(channel);
		return members ? table(members) : {};
	}
	recheck(source) {
		let player = this.players.get(source);
		if (!player) return;
		let left = !1;
		for (let channel of player.radios) checks.jobAllows(source, channel) || (left = !0, this.listen(source, channel, !1));
		left && notify(source, Locale("NOTIFY_RADIO_REVOKED"), "error");
	}
	drop(player) {
		for (let channel of player.radios) this.leaveRadio(player, channel);
		player.call !== 0 && this.leaveCall(player.source, player.call);
	}
	describe() {
		let line = (kind, map) => [...map].map(([id, m]) => `${kind} ${id}: ${[...m.keys()].join(",")}`);
		return [...line("radio", this.radios), ...line("call", this.calls)];
	}
	activate(player, channel) {
		player.radio !== channel && (this.talk(player, !1), player.radio = channel), emitNet(PMA.clSetPlayerRadio, player.source, channel), radioBag.set(player.source, channel);
	}
	refuse(player) {
		emitNet(PMA.removePlayerFromRadio, player.source, player.source, 0), notify(player.source, Locale("NOTIFY_RADIO_DENIED"), "error"), radioBag.set(player.source, player.radio);
	}
	joinRadio(player, channel) {
		let members = this.radios.get(channel);
		members || this.radios.set(channel, members = new Map());
		let source = player.source, name = content.settings.syncNames ? checks.radioName(source) : !1;
		for (let member of members.keys()) emitNet(PMA.addPlayerToRadio, member, source, name, channel);
		members.set(source, !1), player.radios.add(channel), emitNet(PMA.syncRadioData, source, table(members), name, channel), this.router.radioJoin(source, channel);
	}
	leaveRadio(player, channel) {
		let members = this.radios.get(channel);
		if (player.radios.delete(channel), members) {
			player.radio === channel && this.talk(player, !1);
			for (let member of members.keys()) emitNet(PMA.removePlayerFromRadio, member, player.source, channel);
			members.delete(player.source), members.size === 0 && this.radios.delete(channel), this.router.radioLeave(player.source, channel);
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
};
// resource/server/mute.ts
const licenseOf = (source) => GetPlayerIdentifierByType(String(source), "license") || `source:${source}`;
var Mutes = class {
	players;
	mutes = new Map();
	online = new PlayerMap();
	constructor(players) {
		this.players = players;
	}
	toggle(target, by, seconds) {
		if (!this.players.get(target)) return !1;
		let license = licenseOf(target), muted = !this.mutes.has(license), time = Math.min(31536e3, Math.max(1, seconds));
		return muted ? (this.mutes.set(license, {
			until: Date.now() + time * 1e3,
			timer: null
		}), this.arm(license), this.apply(target, license, !0)) : this.end(license, !1), emit(PMA.playerMuted, target, by, muted, time), notify(target, Locale(muted ? "NOTIFY_MUTED" : "NOTIFY_UNMUTED"), "info"), aiLog("mutes", muted ? "voice muted" : "voice unmuted", {
			source: by > 0 ? by : void 0,
			target,
			metadata: { seconds: muted ? time : 0 }
		}), !0;
	}
	join(source) {
		let license = licenseOf(source), mute = this.mutes.get(license);
		mute && mute.until > Date.now() && this.apply(source, license, !0);
	}
	apply(source, license, muted) {
		muted ? this.online.set(source, license) : this.online.delete(source), this.players.setMuted(source, muted);
	}
	arm(license) {
		let mute = this.mutes.get(license);
		if (!mute) return;
		let left = mute.until - Date.now();
		if (left <= 0) return this.end(license);
		mute.timer = setTimeout(() => this.arm(license), Math.min(left, 2147483647));
	}
	end(license, announce = !0) {
		let mute = this.mutes.get(license);
		if (mute) {
			mute.timer && clearTimeout(mute.timer), this.mutes.delete(license);
			for (let [source, l] of this.online) l === license && (this.apply(source, license, !1), announce && emit(PMA.playerMuted, source, 0, !1, 0));
		}
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
	callBystander() {}
	rebuild() {}
	stop() {
		for (let source of this.muted) MumbleSetPlayerMuted(source, !1);
		this.muted.clear();
	}
	describe() {
		return [`server-muted: ${[...this.muted].join(",") || "none"}`];
	}
};
// resource/server/speaker.ts
const key = (a) => `${a.send.join(",")}|${a.call.join(",")}|${a.speaker.join(",")}`;
var Speakers = class {
	players;
	groups;
	router;
	holders = new Map();
	sent = new PlayerMap();
	timer = every(1e3, () => this.update(), {
		active: !1,
		name: "speakers"
	});
	constructor(players, groups, router) {
		this.players = players, this.groups = groups, this.router = router, groups.onCallChange((source) => {
			this.holders.has(source) && this.set(source, !1);
		});
	}
	isOn(source) {
		return this.holders.has(source);
	}
	set(source, on) {
		let player = this.players.get(source);
		return player ? this.apply(player, on) : !1;
	}
	drop(player) {
		let source = player.source;
		this.holders.has(source) && this.apply(player, !1);
		for (let holder of this.holders.values()) holder.near.delete(source);
	}
	apply(player, on) {
		let source = player.source;
		return on && (!content.settings.speaker || player.call === 0) ? !1 : (on === this.holders.has(source) || (player.speaker = on, speakerBag.set(source, on), on ? this.holders.set(source, {
			call: player.call,
			near: new Set()
		}) : (this.place(source, new Set()), this.holders.delete(source)), this.update(), this.timer.set(this.holders.size > 0)), !0);
	}
	update() {
		let radius = content.settings.speakerRadius;
		for (let [source, holder] of this.holders) {
			let members = this.groups.callMembers(holder.call), near = new Set(playersNear(source, radius).filter((id) => id !== source && !members.has(id)));
			this.place(source, near);
		}
		this.router.backend === "mumble" && this.sendAudio();
	}
	place(source, next) {
		let holder = this.holders.get(source);
		if (!holder) return;
		let talks = content.settings.speakerBidirectional;
		for (let id of holder.near) next.has(id) || this.router.callBystander(id, holder.call, !1, talks);
		for (let id of next) holder.near.has(id) || this.router.callBystander(id, holder.call, !0, talks);
		holder.near = next;
	}
	sendAudio() {
		let audio = new Map(), of = (id) => {
			let a = audio.get(id);
			return a || audio.set(id, a = {
				send: [],
				call: [],
				speaker: []
			}), a;
		}, twoWay = content.settings.speakerBidirectional;
		for (let [source, holder] of this.holders) {
			let remote = [...this.groups.callMembers(holder.call).keys()].filter((id) => id !== source);
			for (let b of holder.near) {
				let mine = of(b);
				mine.speaker.push(...remote), twoWay && mine.send.push(...remote);
				for (let r of remote) of(r).send.push(b), twoWay && of(r).call.push(b);
			}
		}
		for (let [id, last] of this.sent) !audio.has(id) && last !== "||" && (emitNet(EVENTS.callAudio, id, {
			send: [],
			call: [],
			speaker: []
		}), this.sent.set(id, "||"));
		for (let [id, a] of audio) {
			let k = key(a);
			this.sent.get(id) !== k && (this.sent.set(id, k), emitNet(EVENTS.callAudio, id, a));
		}
	}
};
// resource/server/takeover.ts
const log$1 = createLogger(ResourceName), takeoverKey = new GlobalKey(KEYS.takeover, parseTakeover), RADIO = ["tgiann-radio-v2", "tgiann-radio"], PHONE = ["tgiann-phone"], WATCHED = new Set([...RADIO, ...PHONE]), detect = () => ({
	radio: RADIO.find((name) => isResourceStarted(name)) ?? null,
	phone: PHONE.find((name) => isResourceStarted(name)) ?? null
});
function watchTakeover() {
	let first = !0, apply = () => {
		let next = detect(), old = takeoverKey.get();
		(first || old?.radio !== next.radio || old?.phone !== next.phone) && (first = !1, takeoverKey.set(next), content.showStatus({
			radioEffectBy: next.radio ?? "",
			phoneEffectBy: next.phone ?? ""
		}), next.radio && log$1.info(`${next.radio} brings its own radio effect`), next.phone && log$1.info(`${next.phone} brings its own phone effect`));
	};
	apply();
	let changed = (resource) => {
		WATCHED.has(resource) && setTimeout(apply, 0);
	};
	on("onResourceStart", changed), on("onResourceStop", changed);
}
// resource/server/index.ts
const log = createLogger(ResourceName);
aiLogChannels({ mutes: {} });
function chooseBackend() {
	let wanted = content.settings.backend, enhanced = wanted !== "mumble" && hasEnhancedVoice();
	return wanted === "enhanced" && !enhanced && log.error("Enhanced voice API missing on this server, using Mumble"), enhanced ? "enhanced" : "mumble";
}
const backend = chooseBackend(), router = backend === "enhanced" ? new EnhancedRouter(() => content.settings.modes.map((m) => m.distance)) : new MumbleRouter();
new GlobalKey(KEYS.backend, parseBackend).set(backend), content.showStatus({ backendActive: backend }), log.info(`voice backend: ${backend}`), watchTakeover();
const players = new Players(router), groups = new Groups(players, router), mutes = new Mutes(players), speakers = new Speakers(players, groups, router);
registerServerExports({
	players,
	groups,
	mutes,
	router,
	speakers
}), registerCommands(players, groups, mutes, router);
function join(source) {
	let mode = proximityBag.get(source)?.index, radio = radioBag.get(source) ?? 0, call = callBag.get(source) ?? 0;
	players.join(source), mutes.join(source), mode !== void 0 && players.setMode(source, mode), radio > 0 && groups.setRadio(source, radio), call > 0 && groups.setCall(source, call, !0);
}
for (let id of getPlayers()) join(Number(id));
on("playerJoining", () => join(eventSource())), players.onDrop((player) => {
	speakers.drop(player), groups.drop(player);
});
const recheck = (source) => {
	typeof source == "number" && setTimeout(() => groups.recheck(source), 0);
};
on(CORE.jobsChangedEvent, recheck), on(CORE.dutyChangedEvent, recheck), on(CORE.gangsChangedEvent, recheck), on(CORE.playerUnloadedEvent, recheck), on(CORE.playerLoadedEvent, recheck), content.onFrequencies(() => {
	for (let player of players.all()) groups.recheck(player.source);
}), content.onSettings((next, old) => {
	JSON.stringify(next.modes) !== JSON.stringify(old.modes) && players.reload(), next.backend !== old.backend && log.warn("the voice backend changes on the next start of ai-voice");
});
const toIndex = ([v]) => asArgs(typeof v == "number" && Number.isInteger(v) && v >= 1 ? v : null), toRange = ([v]) => v == null ? [null] : typeof v == "number" && v >= .5 && v <= 100 ? [v] : null, toChannelArg = ([v]) => asArgs(isChannel(v) ? v : null), toBool = ([v]) => asArgs(typeof v == "boolean" ? v : null), perSecond = (count) => ({
	count,
	windowMs: 1e3
});
onClientEvent(EVENTS.setMode, {
	args: toIndex,
	rate: perSecond(2)
}, (source, index) => players.setMode(source, index)), onClientEvent(EVENTS.setRange, {
	args: toRange,
	rate: perSecond(1)
}, (source, range) => router.backend === "mumble" || range === null ? players.setRange(source, range) : !1), onClientEvent(PMA.setPlayerRadio, {
	args: toChannelArg,
	rate: perSecond(2)
}, (source, channel) => groups.setRadio(source, channel)), onClientEvent(EVENTS.radioListen, {
	args: ([ch, on]) => isChannel(ch) && typeof on == "boolean" ? [ch, on] : null,
	rate: perSecond(2)
}, (source, channel, on) => groups.listen(source, channel, on)), onClientEvent(EVENTS.radioActive, {
	args: toChannelArg,
	rate: perSecond(2)
}, (source, channel) => groups.setActive(source, channel)), onClientEvent(PMA.setTalkingOnRadio, {
	args: toBool,
	rate: perSecond(4)
}, (source, talking) => groups.setRadioTalking(source, talking)), onClientEvent(PMA.setPlayerCall, {
	args: toChannelArg,
	rate: perSecond(2)
}, (source, channel) => {
	if (channel === 0 || checks.canClientJoinCall(source, channel)) return groups.setCall(source, channel, !1);
	log.warn(`player ${source} asked to join call ${channel}: refused`), groups.refuseCall(source);
}), onClientEvent(EVENTS.setSpeaker, {
	args: toBool,
	rate: perSecond(2)
}, (source, on) => speakers.set(source, on)), on("onResourceStop", (resource) => {
	resource === ResourceName && router.stop();
});
