require "pp"
require "enumerator"
IRB.conf[:SAVE_HISTORY] = 1000
IRB.conf[:AUTO_INDENT] = true
IRB.conf[:USE_READLINE] = true

begin
  require "rubygems"
  #gem "activesupport", "<2"
  #gem "activesupport"
  #require "active_support"
  require "wirble"

  Gem.source_index.latest_specs.each do |name, gem|
    if gem
      gem.require_paths.each do |path|
        Dependencies.load_paths << File.join(gem.full_gem_path, path)
      end
    end
  end

  Wirble.init
  Wirble.colorize
rescue LoadError
  require "irb-history"
  require "irb/completion"
end

module Kernel
  def r(arg)
    puts `refe #{arg}`
  end
  private :r
end

class Module
  def r(meth = nil)
    if meth
      if instance_methods(false).include? meth.to_s
        puts `refe #{self}##{meth}`
      else
        super
      end
    else
      puts `refe #{self}`
    end
  end
end
