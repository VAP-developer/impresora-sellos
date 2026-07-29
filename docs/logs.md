> electron-vite build && electron-builder --win

vite v6.4.3 building SSR bundle for production...
✓ 32 modules transformed.
out/main/index.js  138.33 kB
✓ built in 719ms
vite v6.4.3 building SSR bundle for production...
✓ 1 modules transformed.
out/preload/index.js  4.85 kB
✓ built in 19ms
vite v6.4.3 building for production...
✓ 196 modules transformed.
../../out/renderer/index.html                     0.41 kB
../../out/renderer/assets/index-BwyWzRLt.css     39.47 kB
../../out/renderer/assets/index-BYX4LEwG.js   1,238.37 kB
✓ built in 2.23s
  • electron-builder  version=26.15.3 os=10.0.26200
  • loaded configuration  file=C:\Users\jcalo\Desktop\v6-imp\electron-builder.yml
  • writing effective config  file=dist\builder-effective-config.yaml
  • executing @electron/rebuild  electronVersion=30.0.9 arch=x64 buildFromSource=false workspaceRoot=C:\Users\jcalo\Desktop\v6-imp projectDir=./ appDir=./
  • installing native dependencies  arch=x64
  • preparing       moduleName=better-sqlite3 arch=x64
  • finished        moduleName=better-sqlite3 arch=x64
  • completed installing native dependencies
  • packaging       platform=win32 arch=x64 electron=30.0.9 appOutDir=dist\win-unpacked
  • downloading     label=electron
    [=====================================================================] 100% | electron
  • downloaded electron zip extracted successfully  output=C:\Users\jcalo\Desktop\v6-imp\dist\win-unpacked
  • searching for node modules  pm=npm searchDir=C:\Users\jcalo\Desktop\v6-imp
  • duplicate dependency references  dependencies=["@types/node@26.0.1","@types/node@26.0.1","@types/responselike@1.0.3","@types/node@26.0.1","get-stream@5.2.0","responselike@2.0.1","decompress-response@6.0.0","debug@4.4.3","debug@4.4.3","pump@3.0.4","electron@30.0.9","@types/react@18.3.31","react@18.3.1","@types/react@18.3.31","react@18.3.1","@radix-ui/react-primitive@2.1.6","@types/react@18.3.31","react@18.3.1","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@types/react@18.3.31","react@18.3.1","@radix-ui/react-primitive@2.1.6","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@types/react@18.3.31","react@18.3.1","@radix-ui/react-primitive@2.1.6","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-slot@1.3.0","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-slot@1.3.0","@types/react@18.3.31","react@18.3.1","@types/react@18.3.31","react@18.3.1","@types/react@18.3.31","react@18.3.1","loose-envify@1.4.0","@types/react@18.3.31","@types/react@18.3.31","react-style-singleton@2.2.3","react@18.3.1","@types/react@18.3.31","react@18.3.1","react@18.3.1","@types/react@18.3.31","react@18.3.1","@types/react@18.3.31","react@18.3.1","loose-envify@1.4.0","@radix-ui/react-id@1.1.2","@radix-ui/react-collection@1.1.10","@radix-ui/react-dismissable-layer@1.1.13","@radix-ui/react-focus-scope@1.1.10","@radix-ui/react-id@1.1.2","@radix-ui/react-popper@1.3.1","@radix-ui/react-portal@1.1.12","@radix-ui/react-presence@1.1.6","@radix-ui/react-primitive@2.1.6","@radix-ui/react-roving-focus@1.1.13","@radix-ui/react-slot@1.3.0","@types/react@18.3.31","aria-hidden@1.2.6","react-dom@18.3.1","react-remove-scroll@2.7.2","react@18.3.1","@radix-ui/react-primitive@2.1.6","@radix-ui/react-use-controllable-state@1.2.3","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-primitive@2.1.6","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-primitive@2.1.6","@radix-ui/react-slot@1.3.0","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@types/react@18.3.31","react@18.3.1","@radix-ui/react-dismissable-layer@1.1.13","@radix-ui/react-focus-scope@1.1.10","@radix-ui/react-id@1.1.2","react-dom@18.3.1","react@18.3.1","@radix-ui/react-primitive@2.1.6","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-primitive@2.1.6","@types/react@18.3.31","react@18.3.1","@radix-ui/react-use-size@1.1.2","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-portal@1.1.12","@radix-ui/react-presence@1.1.6","@radix-ui/react-primitive@2.1.6","@radix-ui/react-slot@1.3.0","@types/react@18.3.31","react@18.3.1","@radix-ui/react-use-controllable-state@1.2.3","@types/react@18.3.31","react@18.3.1","@types/react@18.3.31","react@18.3.1","@radix-ui/react-primitive@2.1.6","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@types/react@18.3.31","aria-hidden@1.2.6","react-dom@18.3.1","react-remove-scroll@2.7.2","react@18.3.1","@types/react@18.3.31","react@18.3.1","@radix-ui/react-primitive@2.1.6","@radix-ui/react-use-controllable-state@1.2.3","@types/react@18.3.31","react@18.3.1","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-id@1.1.2","@radix-ui/react-presence@1.1.6","@radix-ui/react-primitive@2.1.6","@radix-ui/react-collection@1.1.10","@radix-ui/react-id@1.1.2","@radix-ui/react-primitive@2.1.6","@radix-ui/react-use-controllable-state@1.2.3","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-use-controllable-state@1.2.3","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","@radix-ui/react-dismissable-layer@1.1.13","@radix-ui/react-id@1.1.2","@radix-ui/react-popper@1.3.1","@radix-ui/react-portal@1.1.12","@radix-ui/react-presence@1.1.6","@radix-ui/react-primitive@2.1.6","@radix-ui/react-slot@1.3.0","@radix-ui/react-use-controllable-state@1.2.3","@radix-ui/react-visually-hidden@1.2.6","@types/react@18.3.31","react-dom@18.3.1","react@18.3.1","once@1.4.0","once@1.4.0","pump@3.0.4","readable-stream@3.6.2","end-of-stream@1.4.5","unicode-trie@2.0.0","unicode-trie@2.0.0","react-dom@18.3.1","react@18.3.1","react@18.3.1","react@18.3.1","react-dom@18.3.1","react-dom@18.3.1","react@18.3.1","react@18.3.1","@types/react@18.3.31","react@18.3.1"]
  • updating asar integrity executable resource  executablePath=dist\win-unpacked\Stamp Sales.exe
  • signing with signtool.exe  path=dist\win-unpacked\Stamp Sales.exe
  • signing with signtool.exe  path=dist\win-unpacked\resources\app.asar.unpacked\node_modules\pdf-to-printer\dist\SumatraPDF-3.4.6-32.exe
  • building        target=nsis file=dist\StampSales-Setup-1.0.0.exe archs=x64 oneClick=false perMachine=true
  • signing with signtool.exe  path=dist\win-unpacked\resources\elevate.exe
  ⨯ Language name is unknown for spanish  failedTask=build stackTrace=Error: Language name is unknown for spanish
    at createAddLangsMacro (C:\Users\jcalo\Desktop\v6-imp\node_modules\app-builder-lib\src\targets\nsis\nsisLang.ts:51:15)
    at NsisTarget.computeCommonInstallerScriptHeader (C:\Users\jcalo\Desktop\v6-imp\node_modules\app-builder-lib\src\targets\nsis\NsisTarget.ts:686:24)
    at C:\Users\jcalo\Desktop\v6-imp\node_modules\app-builder-lib\src\targets\nsis\NsisTarget.ts:343:39
    at AsyncTaskManager.add (C:\Users\jcalo\Desktop\v6-imp\node_modules\builder-util\src\asyncTaskManager.ts:13:20)
    at NsisTarget.buildInstaller (C:\Users\jcalo\Desktop\v6-imp\node_modules\app-builder-lib\src\targets\nsis\NsisTarget.ts:342:28)
    at NsisTarget.finishBuild (C:\Users\jcalo\Desktop\v6-imp\node_modules\app-builder-lib\src\targets\nsis\NsisTarget.ts:160:9)
    at Packager.doBuild (C:\Users\jcalo\Desktop\v6-imp\node_modules\app-builder-lib\src\packager.ts:562:7)
    at executeFinally (C:\Users\jcalo\Desktop\v6-imp\node_modules\builder-util\src\promise.ts:12:14)
    at Packager.build (C:\Users\jcalo\Desktop\v6-imp\node_modules\app-builder-lib\src\packager.ts:450:31)
    at executeFinally (C:\Users\jcalo\Desktop\v6-imp\node_modules\builder-util\src\promise.ts:12:14)