require "pp"
require "enumerator"
require "irb/completion"
require "irb/history"
IRB.conf[:SAVE_HISTORY] = 1000
IRB.conf[:AUTO_INDENT] = true
IRB.conf[:USE_READLINE] = true
